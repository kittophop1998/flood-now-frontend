import qrcode from "qrcode-generator";

// Draws a QR (plus a caption under it) onto a canvas and returns it as a
// PNG — for "save QR" on phones, where people save the PromptPay QR and pick
// it from the gallery in their banking app. Error correction M, 4-module
// quiet zone, like components/community/qr-code.tsx. Browser only.
export async function qrPngBlob(value: string, caption: string): Promise<Blob> {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const scale = 12;
  const quiet = 4 * scale;
  const side = n * scale + quiet * 2;
  const captionH = caption ? 72 : 0;

  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side + captionH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(quiet + c * scale, quiet + r * scale, scale, scale);
    }
  }
  if (caption) {
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption, side / 2, side + captionH / 2 - 12);
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

// Shares the PNG where the device can (phones: "Save image"), otherwise
// downloads it.
export async function saveQrImage(value: string, caption: string, filename: string): Promise<void> {
  const blob = await qrPngBlob(value, caption);
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
