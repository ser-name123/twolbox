import "server-only";
import { del, put } from "@vercel/blob";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5MB bodies; the browser shrinks photos first
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Stores a product photo in Vercel Blob and returns its public URL.
// Local dev without a Blob token: falls back to an inline data URL saved in the database.
export async function savePhoto(code: number, file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) throw new Error("Only JPG, PNG or WEBP photos are allowed.");
  if (!hasBlob()) {
    if (process.env.NODE_ENV === "production") throw new Error("Photo storage is not configured (BLOB_READ_WRITE_TOKEN).");
    return `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`products/${code}.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
  return blob.url;
}

export async function deletePhoto(url: string | null | undefined) {
  if (!url || url.startsWith("data:") || !hasBlob()) return;
  try {
    await del(url);
  } catch (e) {
    console.error("blob delete failed", url, e); // an orphaned file is harmless
  }
}
