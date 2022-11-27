/**
 * The maximum size of an uploaded chunk. When uploading a file, it is split into chunks of this size.
 */
export const MaxChunkSize: number = Math.floor(7.6 * 1024 * 1024);
export const ForbiddenNameCharactersTest = /[<>:"/\\|?*]/;
