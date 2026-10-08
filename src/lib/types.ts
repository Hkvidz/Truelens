export const PROOF_VERSION = 1 as const;

export type GeoPoint = {
  lat: number;
  lon: number;
  /** Horizontal accuracy in meters, as reported by the device. */
  accuracy: number;
};

/** Facts captured alongside the photo. All of these get signed. */
export type CaptureMetadata = {
  capturedAt: string; // ISO 8601
  width: number;
  height: number;
  mimeType: string;
  geo: GeoPoint | null;
  device: string;
  nonce: string; // random hex, makes every proof unique
};

/** The complete proof file that travels with a photo. */
export type Proof = CaptureMetadata & {
  version: typeof PROOF_VERSION;
  imageSha256: string;
  publicKey: JsonWebKey; // ECDSA P-256 public key (kty, crv, x, y only)
  keyFingerprint: string; // short, human-comparable ID of publicKey
  signature: string; // base64url of the raw ECDSA r||s signature
};

export type UnsignedProof = Omit<Proof, "signature">;

export type VerificationCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type VerificationResult = {
  valid: boolean;
  checks: VerificationCheck[];
  keyFingerprint: string;
};

/** A saved capture in the local gallery. */
export type CaptureRecord = {
  id: string;
  createdAt: string;
  image: Blob;
  proof: Proof;
};
