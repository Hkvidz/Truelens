import { generateSigningKeyPair } from "./proof";
import type { CaptureRecord } from "./types";

// Everything stays on this device. Keys and photos live in IndexedDB.
const DB_NAME = "truelens";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const CAPTURE_STORE = "captures";
const SIGNING_KEY_ID = "signing-key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CAPTURE_STORE)) db.createObjectStore(CAPTURE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(storeName, mode).objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

let keysPromise: Promise<CryptoKeyPair> | null = null;

/** The device's signing key. Created once, then reused for every capture. */
export function getSigningKeys(): Promise<CryptoKeyPair> {
  keysPromise ??= (async () => {
    const existing = await withStore<CryptoKeyPair & { id: string } | undefined>(KEY_STORE, "readonly", (s) =>
      s.get(SIGNING_KEY_ID),
    );
    if (existing) return { privateKey: existing.privateKey, publicKey: existing.publicKey };
    const pair = await generateSigningKeyPair();
    await withStore(KEY_STORE, "readwrite", (s) => s.put({ id: SIGNING_KEY_ID, ...pair }));
    return pair;
  })();
  return keysPromise;
}

export async function saveCapture(record: CaptureRecord): Promise<void> {
  await withStore(CAPTURE_STORE, "readwrite", (s) => s.put(record));
}

export async function listCaptures(): Promise<CaptureRecord[]> {
  const all = await withStore<CaptureRecord[]>(CAPTURE_STORE, "readonly", (s) => s.getAll());
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteCapture(id: string): Promise<void> {
  await withStore(CAPTURE_STORE, "readwrite", (s) => s.delete(id));
}
