import { CheckCircle2, FileJson, ImageIcon, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { parseProof, verifyProof } from "../lib/proof";
import type { VerificationResult } from "../lib/types";

function FilePicker({
  label,
  hint,
  accept,
  icon: Icon,
  file,
  onPick,
}: {
  label: string;
  hint: string;
  accept: string;
  icon: typeof ImageIcon;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-5 text-center transition hover:border-emerald-500 hover:bg-emerald-50/40">
      <Icon className="mx-auto h-7 w-7 text-stone-500" />
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-stone-500">{file ? file.name : hint}</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export default function VerifyPanel() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (!photo || !proofFile) return;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const proof = parseProof(await proofFile.text());
      setResult(await verifyProof(await photo.arrayBuffer(), proof));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="card space-y-5">
        <div>
          <h2 className="font-display text-xl font-semibold">Check a photo</h2>
          <p className="mt-1 text-sm text-stone-600">
            Pick the photo and its proof file. Nothing is uploaded: the check runs in your browser.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FilePicker label="Photo" hint="JPEG or PNG" accept="image/*" icon={ImageIcon} file={photo} onPick={setPhoto} />
          <FilePicker
            label="Proof file"
            hint=".proof.json"
            accept="application/json,.json"
            icon={FileJson}
            file={proofFile}
            onPick={setProofFile}
          />
        </div>

        <button type="button" className="btn-primary w-full" onClick={check} disabled={!photo || !proofFile || checking}>
          <ShieldCheck className="h-4 w-4" /> {checking ? "Checking…" : "Verify"}
        </button>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className="card">
        {!result ? (
          <div className="grid h-full place-items-center py-16 text-center text-sm text-stone-500">
            The result appears here, with each check explained.
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className={`flex items-start gap-3 rounded-xl p-4 ${
                result.valid ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
              }`}
            >
              {result.valid ? <ShieldCheck className="mt-0.5 h-6 w-6 flex-none" /> : <ShieldAlert className="mt-0.5 h-6 w-6 flex-none" />}
              <div>
                <p className="font-semibold">
                  {result.valid ? "Verified: this photo is unchanged since capture" : "Not verified"}
                </p>
                <p className="mt-1 text-sm">
                  Signed by camera key <span className="font-mono">{result.keyFingerprint}</span>.
                  {result.valid
                    ? " Check that this key matches the camera you expect."
                    : " Do not rely on this photo until the failed checks are resolved."}
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {result.checks.map((check) => (
                <li key={check.id} className="flex gap-3">
                  {check.passed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-none text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-sm text-stone-600">{check.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-lg bg-stone-50 p-4 text-xs text-stone-600">
              <p className="font-semibold text-stone-800">What this does not prove</p>
              <p className="mt-1">
                A verified photo proves that this camera signed these exact bytes at the stated time. It does not prove
                that the scene in front of the camera was real. Someone can still photograph a staged scene or a screen.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
