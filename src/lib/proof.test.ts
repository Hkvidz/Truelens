import { describe, expect, it } from "vitest";
import {
  generateSigningKeyPair,
  keyFingerprint,
  parseProof,
  signCapture,
  stableStringify,
  verifyProof,
} from "./proof";
import type { CaptureMetadata, Proof } from "./types";

const encoder = new TextEncoder();

const metadata: CaptureMetadata = {
  capturedAt: new Date().toISOString(),
  width: 1920,
  height: 1080,
  mimeType: "image/jpeg",
  geo: { lat: 30.7, lon: 71.2, accuracy: 12 },
  device: "test-device",
  nonce: "00112233445566778899aabbccddeeff",
};

const photo = encoder.encode("fake jpeg bytes for testing");

function failedIds(checks: { id: string; passed: boolean }[]): string[] {
  return checks.filter((c) => !c.passed).map((c) => c.id);
}

describe("signing and verification", () => {
  it("verifies an untouched photo and its proof", async () => {
    const keys = await generateSigningKeyPair();
    const proof = await signCapture(photo, metadata, keys);
    const result = await verifyProof(photo, proof);
    expect(result.valid).toBe(true);
    expect(failedIds(result.checks)).toEqual([]);
  });

  it("fails when even one byte of the photo changes", async () => {
    const keys = await generateSigningKeyPair();
    const proof = await signCapture(photo, metadata, keys);
    const tampered = encoder.encode("fake jpeg bytes for testinG");
    const result = await verifyProof(tampered, proof);
    expect(result.valid).toBe(false);
    expect(failedIds(result.checks)).toEqual(["image"]);
  });

  it("fails when signed metadata is edited", async () => {
    const keys = await generateSigningKeyPair();
    const proof = await signCapture(photo, metadata, keys);
    const edited: Proof = { ...proof, geo: { lat: 0, lon: 0, accuracy: 1 } };
    const result = await verifyProof(photo, edited);
    expect(result.valid).toBe(false);
    expect(failedIds(result.checks)).toEqual(["signature"]);
  });

  it("fails when the proof is re-signed with a different key but keeps the old fingerprint", async () => {
    const original = await generateSigningKeyPair();
    const attacker = await generateSigningKeyPair();
    const forged = await signCapture(photo, metadata, attacker);
    const spoofed: Proof = { ...forged, keyFingerprint: (await signCapture(photo, metadata, original)).keyFingerprint };
    const result = await verifyProof(photo, spoofed);
    expect(result.valid).toBe(false);
    expect(failedIds(result.checks)).toContain("fingerprint");
  });

  it("flags a capture time in the future", async () => {
    const keys = await generateSigningKeyPair();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const proof = await signCapture(photo, { ...metadata, capturedAt: future }, keys);
    const result = await verifyProof(photo, proof);
    expect(result.valid).toBe(false);
    expect(failedIds(result.checks)).toEqual(["time"]);
  });

  it("gives the same fingerprint for the same key", async () => {
    const keys = await generateSigningKeyPair();
    const a = await signCapture(photo, metadata, keys);
    const b = await signCapture(encoder.encode("another photo"), { ...metadata, nonce: "ff" }, keys);
    expect(a.keyFingerprint).toBe(b.keyFingerprint);
    expect(a.keyFingerprint).toMatch(/^[0-9a-f]{4}(-[0-9a-f]{4}){3}$/);
  });

  it("never includes the private key in the proof", async () => {
    const keys = await generateSigningKeyPair();
    const proof = await signCapture(photo, metadata, keys);
    expect(proof.publicKey).not.toHaveProperty("d");
    expect(Object.keys(proof.publicKey).sort()).toEqual(["crv", "kty", "x", "y"]);
  });
});

describe("helpers", () => {
  it("stableStringify ignores key order", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("keyFingerprint is deterministic", async () => {
    const jwk = { kty: "EC", crv: "P-256", x: "abc", y: "def" };
    expect(await keyFingerprint(jwk)).toBe(await keyFingerprint({ ...jwk }));
  });

  it("parseProof accepts a real proof and rejects junk", async () => {
    const keys = await generateSigningKeyPair();
    const proof = await signCapture(photo, metadata, keys);
    expect(parseProof(JSON.stringify(proof)).imageSha256).toBe(proof.imageSha256);
    expect(() => parseProof("not json")).toThrow(/not valid JSON/);
    expect(() => parseProof("{}")).toThrow(/missing/);
  });
});
