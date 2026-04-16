import { inflate } from "pako";

/**
 * Decode a Path of Building share code (URL-safe or standard base64 of a
 * zlib-deflated UTF-8 XML document) into the underlying XML string.
 * Throws with "Not a valid PoB code" if the input can't be decoded.
 */
export function decodeBuildCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Not a valid PoB code: empty input");

  // Accept both URL-safe and standard base64, with or without padding.
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  let bytes: Uint8Array;
  try {
    const binary = atob(padded);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    throw new Error("Not a valid PoB code: could not decode base64");
  }

  let inflated: Uint8Array;
  try {
    inflated = inflate(bytes);
  } catch {
    throw new Error("Not a valid PoB code: could not decompress payload");
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(inflated);
}
