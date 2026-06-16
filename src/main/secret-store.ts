import { safeStorage } from "electron";

export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptSecret(secret: string): string {
  if (!isSecureStorageAvailable()) {
    throw new Error("Secure local password storage is unavailable on this device.");
  }

  return safeStorage.encryptString(secret).toString("base64");
}

export function decryptSecret(encryptedSecret: string): string | null {
  if (!encryptedSecret || !isSecureStorageAvailable()) {
    return null;
  }

  try {
    return safeStorage.decryptString(Buffer.from(encryptedSecret, "base64"));
  } catch {
    return null;
  }
}
