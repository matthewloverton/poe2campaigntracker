import { describe, it, expect } from "vitest";
import { inflate, deflate } from "pako";
import { decodeBuildCode } from "./codec";

function toBase64UrlSafe(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

describe("codec.decodeBuildCode", () => {
  it("round-trips simple XML", () => {
    const xml = "<PathOfBuilding><Build/></PathOfBuilding>";
    const deflated = deflate(new TextEncoder().encode(xml));
    const code = toBase64UrlSafe(deflated);
    expect(decodeBuildCode(code)).toBe(xml);
  });

  it("handles URL-safe base64 with padding stripped", () => {
    const xml = "<A/>";
    const deflated = deflate(new TextEncoder().encode(xml));
    const code = toBase64UrlSafe(deflated).replace(/=+$/, "");
    expect(decodeBuildCode(code)).toBe(xml);
  });

  it("throws informative error on non-base64 input", () => {
    expect(() => decodeBuildCode("!!!not-base64!!!")).toThrow(/not a valid/i);
  });

  it("throws informative error on non-zlib payload", () => {
    // valid base64 of the string "hello"
    expect(() => decodeBuildCode("aGVsbG8=")).toThrow(/not a valid/i);
  });

  it("also works with standard base64 (non-URL-safe)", () => {
    const xml = "<B/>";
    const deflated = deflate(new TextEncoder().encode(xml));
    let binary = "";
    for (const b of deflated) binary += String.fromCharCode(b);
    const stdCode = btoa(binary);           // contains '+' and '/'
    expect(decodeBuildCode(stdCode)).toBe(xml);
  });

  it("tolerates surrounding whitespace/newlines from a copy-paste", () => {
    const xml = "<C/>";
    const deflated = deflate(new TextEncoder().encode(xml));
    const code = toBase64UrlSafe(deflated);
    expect(decodeBuildCode(`  \n${code}\n  `)).toBe(xml);
  });
});
