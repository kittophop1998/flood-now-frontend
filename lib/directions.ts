// "Directions" hands off to the device's maps app via a universal Google Maps
// URL (opens the app on Android/iOS when installed, the website otherwise).
// This is plain point-to-point routing: FloodNow does not compute
// flood-avoiding routes. A future route-risk overlay would plug in here.
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function reportShareUrl(reportId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/?report=${encodeURIComponent(reportId)}`;
}

// Web Share API when available (mobile), clipboard otherwise. Resolves to
// what happened so the caller can confirm it to the user.
export async function shareLink(url: string, title: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (err) {
    // The user closing the share sheet isn't a failure.
    if (err instanceof DOMException && err.name === "AbortError") return "shared";
    return "failed";
  }
}
