"use client";

import { memo } from "react";
import { ANNOUNCEMENT_TYPE_META, CCTV_META, IMPORTANT_PLACE_META, OFFICIAL_ICON } from "@/lib/community-meta";
import { SEVERITY_META } from "@/lib/report-meta";
import { cn } from "@/lib/utils";
import type { Announcement, ImportantPlace } from "@/types/community";
import type { AggregateCell } from "@/types/report";

// Aggregated flood zone for the zoomed-out map: a count bubble whose ring
// shows the worst severity inside (with a severity icon when severe, so
// color is never the only cue). Tapping zooms in.
export const ZoneMarker = memo(function ZoneMarker({ cell, label }: { cell: AggregateCell; label: string }) {
  const rank = SEVERITY_META[cell.max_severity].rank;
  const SevIcon = SEVERITY_META[cell.max_severity].icon;
  const size = cell.count >= 100 ? "size-14" : cell.count >= 20 ? "size-12" : "size-10";
  return (
    <button type="button" aria-label={label} className="group relative flex items-center justify-center rounded-full outline-none">
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-[3px] bg-slate-900/85 text-sm font-semibold text-white shadow-lg tabular-nums group-focus-visible:ring-4 group-focus-visible:ring-ring",
          size,
          rank === 4 ? "border-red-500" : rank === 3 ? "border-orange-400" : rank === 2 ? "border-amber-300" : "border-sky-300",
        )}
      >
        {cell.count}
      </span>
      {rank >= 3 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-white text-white",
            rank === 4 ? "bg-red-600" : "bg-orange-500",
          )}
          aria-hidden
        >
          <SevIcon className="size-3" />
        </span>
      )}
    </button>
  );
});

// Important places are rounded squares (reports are circles) so the two
// layers never read as the same thing.
export const ImportantPlaceMarker = memo(function ImportantPlaceMarker({
  place,
  label,
  selected,
}: {
  place: ImportantPlace;
  label: string;
  selected: boolean;
}) {
  const meta = IMPORTANT_PLACE_META[place.category];
  const Icon = meta.icon;
  const inactive = place.status === "closed";
  return (
    <button type="button" aria-label={label} aria-pressed={selected} className="group flex size-11 items-center justify-center outline-none">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border-2 border-white shadow-md transition-transform group-focus-visible:ring-4 group-focus-visible:ring-ring",
          selected && "size-10 scale-110 ring-4 ring-primary/35",
          inactive && "opacity-60 grayscale",
        )}
        style={{ backgroundColor: meta.color }}
      >
        <Icon className="size-[18px] text-white" aria-hidden />
      </span>
    </button>
  );
});

// Official announcements: an indigo shield-badged pin, visually distinct
// from both community reports and important places.
export const AnnouncementMarker = memo(function AnnouncementMarker({
  announcement,
  label,
  selected,
}: {
  announcement: Announcement;
  label: string;
  selected: boolean;
}) {
  const Icon = ANNOUNCEMENT_TYPE_META[announcement.type];
  return (
    <button type="button" aria-label={label} aria-pressed={selected} className="group relative flex size-11 items-center justify-center outline-none">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full border-2 border-white bg-indigo-700 text-white shadow-lg group-focus-visible:ring-4 group-focus-visible:ring-ring",
          selected && "scale-110 ring-4 ring-indigo-300",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-white bg-indigo-900 text-white" aria-hidden>
        <OFFICIAL_ICON className="size-3" />
      </span>
    </button>
  );
});

// Official DOH camera: a small white disc with a navy camera — quieter than
// report markers (no fill color) and round-white unlike places (colored
// squares) or announcements (indigo). Selected: slightly larger with a ring.
// The button keeps a 44 px touch target around the small visual.
export const CctvMarker = memo(function CctvMarker({ label, selected }: { label: string; selected: boolean }) {
  const Icon = CCTV_META.icon;
  return (
    <button type="button" aria-label={label} aria-pressed={selected} className="group flex size-11 items-center justify-center outline-none">
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.25)] transition-transform group-focus-visible:ring-4 group-focus-visible:ring-ring",
          selected && "size-9 border-blue-900 ring-4 ring-blue-900/20",
        )}
        style={{ color: CCTV_META.color }}
      >
        <Icon className={selected ? "size-[18px]" : "size-4"} strokeWidth={2.25} aria-hidden />
      </span>
    </button>
  );
});

// A group of cameras at low zoom: a white pill with the camera icon and the
// count. Tapping zooms in.
export const CctvClusterMarker = memo(function CctvClusterMarker({ count, label }: { count: number; label: string }) {
  const Icon = CCTV_META.icon;
  return (
    <button type="button" aria-label={label} className="group flex h-11 items-center justify-center outline-none">
      <span
        className="flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white pr-2.5 pl-2 text-xs font-semibold tabular-nums shadow-[0_1px_4px_rgba(15,23,42,0.25)] group-focus-visible:ring-4 group-focus-visible:ring-ring"
        style={{ color: CCTV_META.color }}
      >
        <Icon className="size-4" strokeWidth={2.25} aria-hidden />
        {count}
      </span>
    </button>
  );
});
