import imageCompression from "browser-image-compression";

// Longest side of an uploaded photo. The report sheet and ImageKit
// transforms never need more, and smaller uploads finish on weak mobile data.
export const MAX_UPLOAD_DIMENSION = 1600;
const MAX_UPLOAD_MB = 1;

// Resizes and re-encodes a photo client-side before it's uploaded to R2
// (new reports and condition updates alike). PNG photos become JPEG — a
// photo needs no transparency and a PNG barely shrinks. Falls back to the original file if compression fails for any reason — a
// failed compression should never block the user from submitting.
export async function compressReportImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: MAX_UPLOAD_MB,
      maxWidthOrHeight: MAX_UPLOAD_DIMENSION,
      useWebWorker: true,
      fileType: file.type === "image/png" ? "image/jpeg" : file.type,
      initialQuality: 0.8,
    });
  } catch {
    return file;
  }
}
