import { sleep } from "./utils.js";

/**
 * Uploads a file to the webhook. Retries on fail.
 * @param webhookurl The webhook url.
 * @param fileName File name that appears in the channel.
 * @param data Array of file pieces.
 * @returns The link to the uploaded file.
 */
export const webhookUpload = async (
  webhookUrl: string,
  fileName: string,
  data: (Uint8Array | ArrayBuffer)[],
): Promise<string> => {
  const body = new FormData();

  body.append("payload_json", JSON.stringify({}));
  body.append("files[0]", new Blob(data), fileName);

  let response;

  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      body: body,
    }).then((r) => r.json());
  } catch (error) {
    console.error("Upload failed. Retrying...");
    console.error(error);

    await sleep(1000);
  }

  return response.attachments[0].url;
};
