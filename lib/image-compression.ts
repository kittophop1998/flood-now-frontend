import imageCompression from "browser-image-compression";

// Compresses a photo client-side before upload. Falls back to the original
// file if compression fails for any reason — a failed compression should
// never block the user from submitting a report.
export async function compressReportImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    return file;
  }
}
