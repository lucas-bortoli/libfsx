import { decrypt } from "../crypto.js";
import { FileChunk } from "../types.js";
import { sleep } from "../utils.js";

class DownloadStream {
  /**
   * A list of chunks to be downloaded in this stream.
   */
  public chunks: FileChunk[];

  public stream: ReadableStream<Uint8Array>;

  /**
   * How many bytes have been transferred.
   */
  public currentBytes: number;

  /**
   * The total amount of bytes in this file.
   */
  public totalBytes: number;

  public done: boolean;

  /**
   * Key used for decryption.
   */
  private key: CryptoKey;

  private chunkIndex: number;

  constructor(chunks: FileChunk[], key: CryptoKey) {
    this.key = key;
    this.chunks = chunks;
    this.chunkIndex = 0;
    this.done = false;
    this.currentBytes = 0;
    this.totalBytes = chunks.reduce((a, b) => a + b.size, 0);

    this.stream = new ReadableStream({
      /**
       * Called when the sink wants some more data.
       */
      pull: async (controller) => {
        // Check if there are more chunks to be downloaded. If not, close this stream.
        if (this.chunkIndex >= this.chunks.length) {
          controller.close();
          this.done = true;
          return;
        }

        // Fetch next chunk
        const decrypted = await this.getChunk(chunks[this.chunkIndex]);
        controller.enqueue(decrypted);

        this.chunkIndex++;
      },
    });
  }

  /**
   * Downloads a chunk and decrypts it.
   * @param chunk Chunk to be downloaded and decrypted.
   * @returns The decrypted chunk.
   */
  private async getChunk(chunk: FileChunk) {
    let tries = 0;

    while (tries < 3) {
      tries++;

      try {
        const ciphertext = await fetch(chunk.link).then((response) => response.arrayBuffer());
        const decrypted = new Uint8Array(
          await decrypt(new Uint8Array(ciphertext), chunk.iv, this.key),
        );

        this.currentBytes += decrypted.byteLength;

        return decrypted;
      } catch (error) {
        console.error(`Chunk download failed. Try ${tries}`, error);
        await sleep(1000 * (tries * 10));
      }
    }

    throw new Error("Couldn't download chunk.");
  }

  public async waitUntilDone(): Promise<void> {
    while (!this.done) {
      await sleep(100);
    }

    return;
  }
}

export default DownloadStream;
