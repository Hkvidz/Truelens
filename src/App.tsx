import { Aperture, Camera, FolderOpen, ShieldCheck } from "lucide-react";
import { useState } from "react";
import CapturePanel from "./components/CapturePanel";
import GalleryPanel from "./components/GalleryPanel";
import VerifyPanel from "./components/VerifyPanel";

type Tab = "capture" | "gallery" | "verify";

const tabs: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: "capture", label: "Capture", icon: Camera },
  { id: "gallery", label: "Gallery", icon: FolderOpen },
  { id: "verify", label: "Verify", icon: ShieldCheck },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [galleryVersion, setGalleryVersion] = useState(0);
  const bump = () => setGalleryVersion((v) => v + 1);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <Aperture className="h-6 w-6 text-emerald-600" />
            <span className="font-display text-xl font-semibold tracking-tight">Truelens</span>
          </div>

          <nav aria-label="Main" className="flex rounded-xl bg-stone-100 p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === id ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Photos you can prove are real.
          </h1>
          <p className="mt-3 text-stone-600">
            Every photo is signed the moment it's taken. If anyone changes a single pixel, the proof fails.
          </p>
        </div>

        {tab === "capture" && <CapturePanel onSaved={bump} />}
        {tab === "gallery" && <GalleryPanel version={galleryVersion} onChange={bump} />}
        {tab === "verify" && <VerifyPanel />}

        <details className="card mt-12 text-sm text-stone-700">
          <summary className="cursor-pointer font-semibold text-stone-900">How the proof works, and its limits</summary>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="font-semibold">What is signed</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>SHA-256 hash of the exact photo bytes</li>
                <li>Capture time, dimensions, and file type</li>
                <li>Optional location and its accuracy</li>
                <li>A random nonce, so no two proofs are alike</li>
              </ul>
              <p>Signing uses ECDSA P-256. The private key never leaves this device.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Honest limits</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>The key lives in the browser, not secure hardware, so a determined attacker on your device could sign fakes.</li>
                <li>A proof shows that a photo is unchanged, not that the scene was real.</li>
                <li>Location is device-reported and can be spoofed.</li>
                <li>Check the key fingerprint against the camera you expect; this app doesn't yet publish a trusted key list.</li>
              </ul>
            </div>
          </div>
        </details>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-stone-500">
        Truelens · Designed &amp; developed by <span className="font-medium text-stone-700">Hk</span>
      </footer>
    </div>
  );
}
