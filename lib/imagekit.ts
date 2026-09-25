// Derives an ImageKit delivery URL from a stored R2 object key. Mirrors
// apps/api/internal/adapters/outbound/storage/imagekit.go — keep both in
// sync if the transform strategy ever changes.
export function imageKitUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) return null;
  const base = process.env.NEXT_PUBLIC_IMAGEKIT_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${objectKey.replace(/^\/+/, "")}`;
}
