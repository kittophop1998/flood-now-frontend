// "Directions" hands off to the device's maps app via a universal Google Maps
// URL (opens the app on Android/iOS when installed, the website otherwise).
// FloodNow never navigates itself; the Safe Route screen only scores routes
// against community reports, then hands the trip off here.
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

type LatLng = { latitude: number; longitude: number };

export function tripDirectionsUrl(origin: LatLng, destination: LatLng, walking: boolean): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: walking ? "walking" : "driving",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function reportShareUrl(reportId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/?report=${encodeURIComponent(reportId)}`;
}

// Web Share API when available (mobile), clipboard otherwise (the text and
// link together). Resolves to what happened so the caller can confirm it.
export async function shareLink(url: string, title: string, text?: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
    return "copied";
  } catch (err) {
    // The user closing the share sheet isn't a failure.
    if (err instanceof DOMException && err.name === "AbortError") return "shared";
    return "failed";
  }
}
