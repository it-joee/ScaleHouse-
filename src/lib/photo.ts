export async function fileToPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = canvas.toDataURL("image/jpeg", 0.72);
  if (url.length > 350_000) url = canvas.toDataURL("image/jpeg", 0.5);
  if (url.length > 450_000) throw new Error("That photo is still too large. Try a closer crop.");
  return url;
}

export function parsePhotos(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
      }
    } catch {
      // fallback
    }
  }
  return trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export function serializePhotos(photos: string[]): string {
  const clean = photos.map((p) => p.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return clean.join("\n");
}
