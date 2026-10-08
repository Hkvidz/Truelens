import { Camera, Download, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadBlob, fileStamp } from "../lib/download";
import { randomHex, signCapture } from "../lib/proof";
import { getSigningKeys, saveCapture } from "../lib/storage";
import type { CaptureRecord, GeoPoint, Proof } from "../lib/types";

type CameraState = "off" | "starting" | "live" | "error";

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

function getLocation(): Promise<GeoPoint | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: round(pos.coords.latitude, 5),
          lon: round(pos.coords.longitude, 5),
          accuracy: Math.round(pos.coords.accuracy),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

export default function CapturePanel({ onSaved }: { onSaved: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camera, setCamera] = useState<CameraState>("off");
  const [error, setError] = useState<string | null>(null);
  const [withLocation, setWithLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [last, setLast] = useState<{ url: string; record: CaptureRecord } | null>(null);

  // Stop the camera when leaving the tab.
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Free the preview URL when it's replaced.
  useEffect(() => {
    return () => {
      if (last) URL.revokeObjectURL(last.url);
    };
  }, [last]);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("error");
      setError("This browser can't open the camera. Try a current version of Chrome, Safari, or Firefox.");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera("live");
    } catch (err) {
      setCamera("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings and try again."
          : "Could not start the camera. Check that no other app is using it.",
      );
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || camera !== "live" || busy) return;

    setBusy(true);
    setError(null);
    try {
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Could not encode the photo."))),
          "image/jpeg",
          0.92,
        ),
      );

      // Sign the exact bytes we store, so the photo and its proof always match.
      const bytes = await blob.arrayBuffer();
      const geo = withLocation ? await getLocation() : null;
      const keys = await getSigningKeys();
      const proof: Proof = await signCapture(
        bytes,
        {
          capturedAt: new Date().toISOString(),
          width,
          height,
          mimeType: blob.type,
          geo,
          device: navigator.platform || "unknown device",
          nonce: randomHex(16),
        },
        keys,
      );

      const record: CaptureRecord = { id: crypto.randomUUID(), createdAt: proof.capturedAt, image: blob, proof };
      await saveCapture(record);
      setLast({ url: URL.createObjectURL(blob), record });
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed.");
    } finally {
      setBusy(false);
    }
  };

  const downloadProof = (record: CaptureRecord) => {
    const json = JSON.stringify(record.proof, null, 2);
    downloadBlob(new Blob([json], { type: "application/json" }), `truelens-${fileStamp(record.createdAt)}.proof.json`);
  };

  const downloadPhoto = (record: CaptureRecord) => {
    downloadBlob(record.image, `truelens-${fileStamp(record.createdAt)}.jpg`);
  };

  const live = camera === "live";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="card overflow-hidden p-0">
        <div className="relative aspect-[4/3] bg-stone-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${live ? "block" : "hidden"}`}
            aria-label="Live camera preview"
          />
          {flash && <div className="absolute inset-0 bg-white/80" aria-hidden="true" />}

          {!live && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-stone-300">
              <div>
                <Camera className="mx-auto h-10 w-10 text-stone-500" />
                <p className="mt-4 text-sm">
                  {camera === "starting" ? "Starting camera…" : "Your camera is off. Start it to take a verified photo."}
                </p>
              </div>
            </div>
          )}

          {live && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live capture
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={withLocation}
              onChange={(e) => setWithLocation(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <MapPin className="h-4 w-4" /> Include location
          </label>

          {!live ? (
            <button type="button" onClick={startCamera} disabled={camera === "starting"} className="btn-primary">
              <Camera className="h-4 w-4" /> {camera === "starting" ? "Starting…" : "Start camera"}
            </button>
          ) : (
            <button type="button" onClick={capture} disabled={busy} className="btn-primary">
              <span className="h-4 w-4 rounded-full border-2 border-white" aria-hidden="true" />
              {busy ? "Signing…" : "Take verified photo"}
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </section>

      <aside className="space-y-6">
        {last ? (
          <div className="card space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-semibold">Signed and saved</h2>
            </div>
            <img src={last.url} alt="Your latest verified capture" className="w-full rounded-xl" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-stone-500">Captured</dt>
              <dd>{new Date(last.record.createdAt).toLocaleString()}</dd>
              <dt className="text-stone-500">Size</dt>
              <dd>
                {last.record.proof.width} × {last.record.proof.height}
              </dd>
              <dt className="text-stone-500">Location</dt>
              <dd>{last.record.proof.geo ? `±${last.record.proof.geo.accuracy} m` : "Not included"}</dd>
              <dt className="text-stone-500">Photo SHA-256</dt>
              <dd className="font-mono text-xs break-all">{last.record.proof.imageSha256.slice(0, 32)}…</dd>
              <dt className="text-stone-500">Camera key</dt>
              <dd className="font-mono text-xs">{last.record.proof.keyFingerprint}</dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => downloadPhoto(last.record)}>
                <Download className="h-4 w-4" /> Photo
              </button>
              <button type="button" className="btn-secondary" onClick={() => downloadProof(last.record)}>
                <Download className="h-4 w-4" /> Proof file
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Share both files. Anyone can check them on the Verify tab.
            </p>
          </div>
        ) : (
          <div className="card text-sm text-stone-600">
            <h2 className="font-semibold text-stone-900">How capture works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>The photo is taken live in this app. Uploads are not accepted here.</li>
              <li>The exact image bytes are hashed with SHA-256.</li>
              <li>The hash, time, size, and optional location are signed with a key stored on this device.</li>
              <li>You get a photo and a proof file that together can be checked later.</li>
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}
