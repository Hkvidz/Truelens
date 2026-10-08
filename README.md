# Truelens

**A camera that proves your photos are real.**

Truelens signs every photo at the moment it is taken. The signature covers the exact image bytes and the capture details, including the time, size, and optional location. Anyone can then check a shared photo and its proof file to see whether it has been changed since capture.

Everything runs in the browser. Photos and keys stay on the device, and verification happens locally, so nothing is uploaded.

## Features

- **Live capture only.** Photos are taken with the in-app camera. File uploads are not accepted as captures.
- **Signed proofs.** Each capture gets an ECDSA P-256 signature over a SHA-256 hash of the photo plus its metadata.
- **Optional location.** Location is included only if you turn it on for that capture.
- **Local gallery.** Photos and proofs are stored in IndexedDB. You can download or delete them at any time.
- **Verify tab.** Pick a photo and its proof file. Each check is shown with a plain-language explanation.
- **Tamper detection.** Changing one pixel, one byte of metadata, the timestamp, or the key all cause verification to fail.

## How it works

1. The camera frame is encoded as JPEG, and the exact bytes are hashed with SHA-256.
2. The hash, timestamp, dimensions, MIME type, optional location, device label, and a random nonce are serialized with deterministic JSON.
3. That payload is signed with a non-extractable ECDSA P-256 key stored on the device.
4. The output is two files: the photo and a `.proof.json` containing the metadata, the public key, a short key fingerprint, and the signature.
5. Verification recomputes the hash, checks the signature against the public key, validates the fingerprint, and checks that the timestamp is not in the future.

## Honest limits

Truelens is a proof of **integrity and origin**, not proof that a scene is real.

- The signing key lives in the browser, not in secure hardware. Someone with control of the device could sign fake photos. Hardware-backed keys (Secure Enclave, Android Key Attestation) are the planned next step.
- A verified photo shows that this camera signed these exact bytes at the stated time. It does not show that the scene was genuine. Someone can photograph a staged scene or a screen.
- Location is reported by the device and can be spoofed.
- The key fingerprint identifies which key signed a photo. This app does not yet publish a list of trusted keys, so check the fingerprint against the camera you expect.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5174
npm test           # unit tests for signing and verification
npm run build      # typecheck + production build
```

Camera access requires a secure context (HTTPS or `localhost`).

## Project layout

```
src/
├── lib/
│   ├── types.ts        # Proof and metadata types
│   ├── proof.ts        # Hashing, signing, verification, parsing
│   ├── proof.test.ts   # Tamper, forgery, and wrong-key tests
│   ├── storage.ts      # IndexedDB: device key and gallery
│   └── download.ts     # File download helpers
├── components/
│   ├── CapturePanel.tsx  # Live camera capture and signing
│   ├── GalleryPanel.tsx  # Saved captures
│   └── VerifyPanel.tsx   # Photo + proof checker
├── App.tsx
└── main.tsx
```

## Roadmap

- Hardware-backed signing keys on iOS and Android
- Trusted key registry and a public verification page
- Export to C2PA / Content Credentials so other tools can read the proof
- Signed proofs for edits, so a legitimate crop or resize keeps a verifiable history

## Developer

Designed and developed by **Hk**.
