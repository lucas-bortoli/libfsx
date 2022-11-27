import { MaxChunkSize } from "../constants.js";
import { encrypt } from "../crypto.js";
import { FileChunk } from "../types.js";
import { sleep } from "../utils.js";
import Webhook from "../webhook.js";

export default class UploadStream {
  public stream: WritableStream<Uint8Array>;

  /**
   * An array of uploaded file chunks.
   */
  public chunks: FileChunk[];

  public done: boolean;

  /**
   * Total number of bytes consumed by this stream.
   */
  public totalBytes: number;

  private key: CryptoKey;
  private webhook: Webhook;
  private buffer: Uint8Array[];

  /**
   * Starts a file upload to the server. Resolves with an array of links (chunks).
   * @param webhook Webhook where the files are uploaded.
   */
  constructor(webhook: Webhook, key: CryptoKey) {
    this.key = key;
    this.webhook = webhook;
    this.buffer = [];
    this.chunks = [];
    this.done = false;
    this.totalBytes = 0;

    this.stream = new WritableStream<Uint8Array>({
      /**
       * Called when there is some more data to write.
       */
      write: async (chunk) => {
        // If this chunk still fits in our buffer, put it there
        if (this.bytesInBuffer() + chunk.byteLength <= MaxChunkSize) {
          this.buffer.push(chunk);
        } else {
          // Or else, flush the buffer and start filling it again
          await this.flush();

          this.buffer = [chunk];
        }
      },

      /**
       * Called when the source stream has finished feeding us data.
       * Flushes the rest of the data in the buffer, and resolves.
       */
      close: async () => {
        await this.flush();

        console.log(`Stream closed.`);
        this.done = true;
      },

      /**
       * Called when an error has ocurred. Clears the buffer and rejects.
       * @param reason
       */
      abort: (reason) => {
        // Abort stream. Clear buffer and throw.
        this.buffer = [];
        throw new Error(reason);
      },
    });
  }

  public async waitUntilDone(): Promise<void> {
    while (!this.done) {
      await sleep(100);
    }

    return;
  }

  /**
   * Uploads the entire buffer to the webhook, and clears it.
   */
  private async flush() {
    console.log(`Flushing ${this.bytesInBuffer()} bytes`);

    // Encrypt data
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Concat all arrays into one large array (bad news: we use twice the amount of memory here,
    // but not for long -- we deallocate it at the end of this function)
    const raw = new Uint8Array(this.bytesInBuffer());
    let i = 0;
    for (const a of this.buffer) {
      raw.set(a, i);
      i += a.byteLength;
    }

    const data = await encrypt(raw, iv, this.key);
    const link = await this.webhook.upload("blob", [data]);

    this.chunks.push({
      size: data.byteLength,
      link: link,
      iv: iv,
    });

    this.totalBytes += data.byteLength;
    this.buffer = [];
  }

  /**
   * @returns The amount of bytes in the internal buffer.
   */
  private bytesInBuffer() {
    return this.buffer.reduce((a, b) => a + b.byteLength, 0);
  }
}
