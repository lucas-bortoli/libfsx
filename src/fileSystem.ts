import {
  DefaultEncryptionKey,
  EncryptionKeyHashSalt,
  ForbiddenNameCharactersTest,
} from "./constants.js";
import { createHash512, getKey, getKeyMaterial } from "./crypto.js";
import { ForbiddenCharactersError, InvalidNameError, InvalidOperationError } from "./errors.js";
import {
  IFileSystemDirectory,
  IFileSystemFile,
  IFileSystemNode,
  IFileSystemNodeType,
  FileSystemHeaders,
  FileChunk,
} from "./types.js";
import UploadStream from "./streams/upload.js";
import DownloadStream from "./streams/download.js";
import { basename, dirname, hexToUi8Array, ui8ArrayToHex } from "./utils.js";
import Webhook from "./webhook.js";

class FileSystem {
  private root: IFileSystemDirectory;
  private encryptionSalt: Uint8Array;
  private encryptionKey: CryptoKey;
  private masterKey: string;

  public headers: Map<FileSystemHeaders, string>;
  public webhook: Webhook;

  constructor(webhook: Webhook, masterKey?: string) {
    if (!webhook) {
      throw new Error("Required parameter missing: webhook");
    }

    this.webhook = webhook;
    this.masterKey = masterKey ?? DefaultEncryptionKey;
  }

  /**
   * Initializes the filesystem. If specified, the `restore` parameter makes
   * this function restore the filesystem state from a buffer.
   * @param restore
   */
  public async init(sourceData?: ArrayBuffer) {
    // Create root node
    this.root = { name: "", children: [], type: IFileSystemNodeType.Directory };

    // Initialize cryptography data for this new filesystem
    this.encryptionSalt = crypto.getRandomValues(new Uint8Array(16));
    this.encryptionKey = await getKey(await getKeyMaterial(this.masterKey), this.encryptionSalt);

    // Default header values
    this.headers = new Map();
    this.headers.set("FileSystem-Version", "1");
    this.headers.set("Creation-Date", new Date().toISOString());
    this.headers.set("Description", "A data container");
    this.headers.set("Tags", "");
    this.headers.set("Use-Encryption", "1");
    this.headers.set("Encryption-Salt", ui8ArrayToHex(this.encryptionSalt));
    this.headers.set(
      "Encryption-Key-Hash",
      ui8ArrayToHex(await createHash512(this.masterKey + EncryptionKeyHashSalt)),
    );

    if (sourceData) {
      const data = new TextDecoder().decode(sourceData);

      // If this is false, then we're still parsing the headers.
      // This is flipped when we encounter a blank line, which indicates the end
      // of the header section.
      let isDoneReadingHeaders = false;

      for (const line of data.split("\n")) {
        if (!isDoneReadingHeaders) {
          // Check if this is the end of the header section
          if (line.length < 1) {
            isDoneReadingHeaders = true;
            continue;
          }

          // Parse header
          let colonIndex = line.indexOf(":");
          let [key, value] = [line.slice(0, colonIndex), line.slice(colonIndex + 1)];
          key = key.trim();
          value = value.trim();

          if (key === "Encryption-Key-Hash") {
            let givenKeyHash = ui8ArrayToHex(
              await createHash512(this.masterKey + EncryptionKeyHashSalt),
            );
            let storedKeyHash = ui8ArrayToHex(await createHash512(value + EncryptionKeyHashSalt));

            if (givenKeyHash !== storedKeyHash) {
              throw new Error(
                "Invalid encryption key hash. The given key (passed to the constructor) doesn't match the key stored in the file.\n\nIs the encryption key correct? Keep in mind that encryption keys cannot be changed.",
              );
            }
          }

          this.headers.set(key as FileSystemHeaders, value);
        } else {
          // Parse entry
          let [path, size, creationDate, metaUrl] = line.split("\t");

          this.setNode(dirname(path), {
            type: IFileSystemNodeType.File,
            name: basename(path),
            size: parseInt(size),
            creationDate: parseInt(creationDate),
            metaUrl: metaUrl,
          } as IFileSystemFile);
        }
      }

      this.encryptionSalt = hexToUi8Array(this.headers.get("Encryption-Salt") as string);
      this.encryptionKey = await getKey(await getKeyMaterial(this.masterKey), this.encryptionSalt);
    }
  }

  /**
   * Exports the filesystem state into a buffer. This state can be restored, later on,
   * by using the `restore` parameter of the `init()` function.
   * @returns A snapshot of the filesystem state
   */
  public async export(): Promise<Uint8Array> {
    const lines: string[] = [];

    for (const [key, value] of this.headers.entries()) {
      lines.push(`${key}: ${value}`);
    }

    lines.push("");

    await this.walkDirectory(this.root, async (file, path) => {
      lines.push([path, file.size, file.creationDate, file.metaUrl].join("\t"));
    });

    return new TextEncoder().encode(lines.join("\n"));
  }

  /**
   * Returns the node at the given path.
   * @param path Path to the node
   * @returns The node, if found, or null.
   */
  public getNode(path: string): IFileSystemNode | null {
    const segments = path.split("/").filter((s) => s.length);

    // Start search at the root directory
    let current: IFileSystemNode | null = this.root;

    while (current && segments.length) {
      const name = segments.shift();

      if (current.type === IFileSystemNodeType.Directory) {
        current = (current as IFileSystemDirectory).children.find((c) => c.name === name) ?? null;
      } else {
        current = null;
      }
    }

    return current;
  }

  /**
   * Sets a node at the given path.
   * @param parentDirectory Path to the node's parent directory
   * @param node Node to be set
   */
  public setNode(parentDirectory: string, node: IFileSystemNode) {
    if (ForbiddenNameCharactersTest.test(node.name)) {
      throw new ForbiddenCharactersError(node.name);
    } else if (node.name.length < 1) {
      throw new InvalidNameError(node.name);
    }

    const segments = parentDirectory.split("/").filter((s) => s.length);

    // Start search at the root directory
    let current: IFileSystemDirectory = this.root;

    while (segments.length) {
      const name = segments.shift() as string;

      if (current.type === IFileSystemNodeType.Directory) {
        let child = current.children.find((c) => c.name === name);

        // Child doesn't exist yet. Create it.
        if (!child) {
          child = {
            name: name,
            children: [],
            type: IFileSystemNodeType.Directory,
          } as IFileSystemDirectory;
          current.children.push(child);
        } else if (child.type !== IFileSystemNodeType.Directory) {
          throw new InvalidOperationError("The given parent path is not a directory.");
        }

        current = child as IFileSystemDirectory;
      } else {
        throw new InvalidOperationError("The given parent path is not a directory.");
      }
    }

    // Now, we place the child node in the current directory
    // Remove old children with this name
    current.children = current.children.filter((c) => c.name !== node.name);
    current.children.push(node);
  }

  /**
   * Recursively iterates over every file in the given folder.
   * @param startDirectory Starting folder iteration
   * @param callback Callback to be called in every file found
   */
  private async walkDirectory(
    startDirectory: IFileSystemDirectory,
    callback: (file: IFileSystemFile, path: string) => Promise<void>,
    _pathAcc: string[] = [],
  ) {
    for (const child of startDirectory.children) {
      if (child.type === IFileSystemNodeType.Directory) {
        await this.walkDirectory(child as IFileSystemDirectory, callback, [
          ..._pathAcc,
          child.name,
        ]);
      } else {
        await callback(child as IFileSystemFile, "/" + [..._pathAcc, child.name].join("/"));
      }
    }
  }

  /**
   * Creates a "meta" file, which describes each file uploaded in the application.
   * A meta file contains the link to each chunk of an uploaded file, and its crypto iv.
   * This is called after `upload()` uploads a file.
   * @param file The file
   * @returns A link to the meta file.
   */
  private async createMetaFile(chunks: FileChunk[]): Promise<string> {
    const encoder = new TextEncoder();
    const data: string[] = [];

    // Write header
    data.push(["index", "size", "iv", "link"].join("\t"));

    // Write fields
    for (const [index, chunk] of chunks.entries()) {
      data.push([index, chunk.size, ui8ArrayToHex(chunk.iv), chunk.link].join("\t"));
    }

    const blob = encoder.encode(data.join("\n"));

    return await this.webhook.upload("meta", [blob]);
  }

  private async fetchMetaFile(link: string): Promise<FileChunk[]> {
    const chunks: FileChunk[] = [];
    const data = (await fetch(link).then((r) => r.text())).split("\n");

    // Remove header line
    data.shift();

    for (const row of data) {
      const [index, size, ivHex, link] = row.split("\t");
      chunks.push({
        iv: hexToUi8Array(ivHex),
        link,
        size: parseInt(size),
      });
    }

    return chunks;
  }

  public async beginUpload(fileName: string) {
    const stream = new UploadStream(this.webhook, this.encryptionKey);

    stream.waitUntilDone().then(async () => {
      const metaFileUrl = await this.createMetaFile(stream.chunks);

      this.setNode(dirname(fileName), {
        name: basename(fileName),
        creationDate: Date.now(),
        size: stream.totalBytes,
        metaUrl: metaFileUrl,
        type: IFileSystemNodeType.File,
      } as IFileSystemFile);
    });

    return stream;
  }

  public async beginDownload(fileName: string) {
    const node = this.getNode(fileName);

    if (!node || node.type !== IFileSystemNodeType.File) {
      throw new Error("Not a file");
    }

    const chunks = await this.fetchMetaFile((node as IFileSystemFile).metaUrl);
    const stream = new DownloadStream(chunks, this.encryptionKey);

    return stream;
  }
}

export default FileSystem;
