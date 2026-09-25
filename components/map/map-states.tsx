import { AlertTriangle, Loader2, MapPinOff } from "lucide-react";

export function MapLoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60">
      <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-medium shadow">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading reports…
      </div>
    </div>
  );
}

export function MapErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex justify-center p-3">
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-2.5 text-sm shadow-lg">
        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
        <span>{message}</span>
        <button type="button" onClick={onRetry} className="font-semibold text-primary underline underline-offset-2">
          Retry
        </button>
      </div>
    </div>
  );
}

export function LocationDeniedBanner() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex justify-center p-3">
      <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm shadow-lg">
        <MapPinOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>Location unavailable — showing a default area. You can still report and browse.</span>
      </div>
    </div>
  );
}
