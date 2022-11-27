/**
 * The maximum size of an uploaded chunk. When uploading a file, it is split into chunks of this size.
 */
export const MaxChunkSize: number = Math.floor(7.6 * 1024 * 1024);
export const ForbiddenNameCharactersTest = /[<>:"/\\|?*]/;

/**
 * When an encryption key is not specified, the application uses this constant as the key.
 * It doesn't make it secure, but the uploaded contents are still somewhat obfuscated.
 * This is unsafe!!! This key is public.
 */
export const DefaultEncryptionKey: string = "gp?mzj;C>[(N;X`agGt,iT;%c$DfOGR(";

/**
 * Salt used to store the hash of the encryption key in the header.
 */
export const EncryptionKeyHashSalt: string = "V['Np6tb$g:h4Y%;";