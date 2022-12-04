/**
 * @param ms Number of milliseconds to wait
 * @returns A promise which resolves after the specified amount of time, in seconds.
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const dirname = (path: string) => {
  const segments = path.split(/[\\/]/).filter((s) => s.length);
  segments.pop();
  return "/" + segments.join("/");
};

export const basename = (path: string) => {
  return path.split(/[\\/]/).pop() || "";
};

export const ui8ArrayToHex = (arr: Uint8Array): string => {
  return Array.from(arr)
    .map((byte) => ("0" + (byte & 0xff).toString(16)).slice(-2))
    .join("");
};

export const hexToUi8Array = (hex: string): Uint8Array => {
  var result: number[] = [];
  for (var i = 0; i < hex.length; i += 2) {
    result.push(parseInt(hex.substr(i, 2), 16));
  }
  return Uint8Array.from(result);
};
