import {
  PROOF_VERSION,
  type CaptureMetadata,
  type Proof,
  type UnsignedProof,
  type VerificationCheck,
  type VerificationResult,
} from "./types";

const encoder = new TextEncoder();
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomHex(byteLength: number): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function sha256Hex(data: BufferSource): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}

/**
 * Deterministic JSON: object keys sorted, undefined values dropped.
 * The signer and the verifier must serialize the same fields the same way,
 * so this is the single source of truth for what gets signed.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const body = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",");
  return `{${body}}`;
}

/** Short ID for a public key, e.g. "3fa9-0c1e-…". Stable for the same key. */
export async function keyFingerprint(jwk: JsonWebKey): Promise<string> {
  const material = stableStringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const hex = await sha256Hex(encoder.encode(material));
  return hex.slice(0, 16).match(/.{4}/g)!.join("-");
}

export function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  // The private key is non-extractable: page scripts can use it to sign,
  // but cannot read the raw key material back out.
  return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
}

/** Hash the exact image bytes, bind them to the metadata, and sign the result. */
export async function signCapture(
  image: BufferSource,
  metadata: CaptureMetadata,
  keys: CryptoKeyPair,
): Promise<Proof> {
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const unsigned: UnsignedProof = {
    ...metadata,
    version: PROOF_VERSION,
    imageSha256: await sha256Hex(image),
    publicKey: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    keyFingerprint: await keyFingerprint(jwk),
  };
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    encoder.encode(stableStringify(unsigned)),
  );
  return { ...unsigned, signature: bytesToBase64Url(new Uint8Array(signature)) };
}

/** Runs every check and reports each one, so the UI can explain exactly what failed. */
export async function verifyProof(image: BufferSource, proof: Proof): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];

  checks.push({
    id: "version",
    label: "Proof format is supported",
    passed: proof.version === PROOF_VERSION,
    detail: proof.version === PROOF_VERSION ? `Version ${PROOF_VERSION}.` : `Unknown version: ${String(proof.version)}.`,
  });

  const actualHash = await sha256Hex(image);
  const photoOk = actualHash === proof.imageSha256;
  checks.push({
    id: "image",
    label: "Photo is unchanged since capture",
    passed: photoOk,
    detail: photoOk
      ? "Every byte matches the signed capture."
      : "This file is not the photo that was signed. It was edited, re-saved, or swapped.",
  });

  let signatureOk = false;
  let fingerprintOk = false;
  try {
    const fingerprint = await keyFingerprint(proof.publicKey);
    fingerprintOk = fingerprint === proof.keyFingerprint;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      proof.publicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );
    const { signature, ...unsigned } = proof;
    signatureOk = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64UrlToBytes(signature),
      encoder.encode(stableStringify(unsigned)),
    );
  } catch {
    signatureOk = false;
  }

  checks.push({
    id: "signature",
    label: "Signature matches the metadata",
    passed: signatureOk,
    detail: signatureOk
      ? "The signed details (time, size, location, device) have not been altered."
      : "The metadata or signature does not verify. The proof was tampered with.",
  });

  checks.push({
    id: "fingerprint",
    label: "Key fingerprint is consistent",
    passed: fingerprintOk,
    detail: fingerprintOk ? "The key ID matches its public key." : "The key ID does not match the public key.",
  });

  const capturedMs = Date.parse(proof.capturedAt);
  const timeOk = Number.isFinite(capturedMs) && capturedMs <= Date.now() + MAX_CLOCK_SKEW_MS;
  checks.push({
    id: "time",
    label: "Capture time is plausible",
    passed: timeOk,
    detail: timeOk ? "The timestamp is not in the future." : "The timestamp is invalid or in the future.",
  });

  return {
    valid: checks.every((check) => check.passed),
    checks,
    keyFingerprint: proof.keyFingerprint,
  };
}

/** Parses an uploaded proof file and rejects anything that isn't shaped like one. */
export function parseProof(text: string): Proof {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (typeof data !== "object" || data === null) throw new Error("This is not a Truelens proof file.");
  const candidate = data as Record<string, unknown>;
  const stringFields = ["imageSha256", "capturedAt", "signature", "keyFingerprint", "mimeType", "device", "nonce"];
  const numberFields = ["width", "height"];
  for (const field of stringFields) {
    if (typeof candidate[field] !== "string") throw new Error(`Proof is missing "${field}".`);
  }
  for (const field of numberFields) {
    if (typeof candidate[field] !== "number") throw new Error(`Proof is missing "${field}".`);
  }
  if (typeof candidate.publicKey !== "object" || candidate.publicKey === null) {
    throw new Error('Proof is missing "publicKey".');
  }
  return candidate as unknown as Proof;
}
