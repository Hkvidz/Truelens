import { Download, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadBlob, fileStamp } from "../lib/download";
import { deleteCapture, listCaptures } from "../lib/storage";
import type { CaptureRecord } from "../lib/types";

type Item = CaptureRecord & { thumb: string };

export default function GalleryPanel({ version, onChange }: { version: number; onChange: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    setLoading(true);
    listCaptures()
      .then((records) => {
        if (cancelled) return;
        const withThumbs = records.map((record) => {
          const thumb = URL.createObjectURL(record.image);
          created.push(thumb);
          return { ...record, thumb };
        });
        setItems(withThumbs);
      })
      .catch(() => !cancelled && setError("Could not read your saved photos on this device."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [version]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this photo and its proof from this device? This can't be undone.")) return;
    await deleteCapture(id);
    onChange();
  };

  if (loading) return <p className="text-sm text-stone-500">Loading your gallery…</p>;
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="card grid place-items-center gap-3 py-16 text-center">
        <ImageOff className="h-10 w-10 text-stone-400" />
        <p className="font-semibold">No verified photos yet</p>
        <p className="max-w-sm text-sm text-stone-500">
          Photos you take on the Capture tab appear here, each with its proof file.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="card overflow-hidden p-0">
          <img src={item.thumb} alt={`Verified photo taken ${new Date(item.createdAt).toLocaleString()}`} className="aspect-[4/3] w-full object-cover" />
          <div className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium">{new Date(item.createdAt).toLocaleString()}</p>
              <p className="font-mono text-xs text-stone-500">Key {item.proof.keyFingerprint}</p>
              <p className="text-xs text-stone-500">
                {item.proof.geo ? `Location ±${item.proof.geo.accuracy} m` : "No location"} · {item.proof.width}×
                {item.proof.height}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-xs"
                onClick={() => downloadBlob(item.image, `truelens-${fileStamp(item.createdAt)}.jpg`)}
              >
                <Download className="h-3.5 w-3.5" /> Photo
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-xs"
                onClick={() =>
                  downloadBlob(
                    new Blob([JSON.stringify(item.proof, null, 2)], { type: "application/json" }),
                    `truelens-${fileStamp(item.createdAt)}.proof.json`,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> Proof
              </button>
              <button type="button" className="btn-secondary px-3 py-2 text-xs text-red-700" onClick={() => remove(item.id)}>
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
