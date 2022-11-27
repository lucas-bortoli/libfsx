/**
 * Returns a key material, with a master key supplied by the user.
 * @param plaintextMasterKey Plain text master key, supplied by the user.
 * @returns A promise to a key material.
 */
export const getKeyMaterial = (plaintextMasterKey: string) => {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(plaintextMasterKey), { name: "pbkdf2" }, false, [
    "deriveBits",
    "deriveKey",
  ]);
};

/**
 * Gets the key used of encryption and decryption of arbitrary binary data in the application.
 * @param keyMaterial The key material, obtained with `getKeyMaterial()`
 * @param salt Key salt, unique to each filesystem.
 * @returns The key used for encryption and decryption of files.
 */
export const getKey = (keyMaterial: CryptoKey, salt: Uint8Array) => {
  return crypto.subtle.deriveKey(
    {
      name: "pbkdf2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
};

/**
 * Encrypts arbitrary binary data.
 * @param data The data to be encrypted.
 * @param iv The initialization vector. A 12-item Uint8Array.
 * @param key Key used for encryption.
 * @returns The encrypted data.
 */
export const encrypt = (data: Uint8Array, iv: Uint8Array, key: CryptoKey) => {
  return crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data,
  );
};

/**
 * Encrypts arbitrary binary data.
 * @param data The data to be decrypted.
 * @param iv The initialization vector. A 12-item Uint8Array.
 * @param key Key used for decryption.
 * @returns The decrypted data.
 */
export const decrypt = (ciphertext: Uint8Array, iv: Uint8Array, key: CryptoKey) => {
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    ciphertext,
  );
};
