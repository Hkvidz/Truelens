export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** e.g. "2026-10-09T12:30:05.123Z" -> "2026-10-09_12-30-05" */
export function fileStamp(iso: string): string {
  return iso.slice(0, 19).replace(/[:T]/g, (c) => (c === "T" ? "_" : "-"));
}
