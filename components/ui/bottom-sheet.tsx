"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SheetSnap = "peek" | "half" | "full";
const ORDER: SheetSnap[] = ["peek", "half", "full"];

const HANDLE_PX = 20;
const DRAG_THRESHOLD_PX = 6;
const FLICK_VELOCITY = 0.45; // px/ms
const CLOSE_OVERSHOOT_PX = 72;

// A non-modal, draggable bottom sheet that sits above the bottom navigation
// and leaves the map usable around it (no backdrop). The `peek` slot is always
// visible; `children` scroll below it once the sheet is expanded. On wide
// screens it floats as a left-hand panel.
export function BottomSheet({
  open,
  snap,
  onSnapChange,
  onClose,
  labelledBy,
  peek,
  children,
  expandLabel,
  collapseLabel,
  onVisibleHeightChange,
}: {
  open: boolean;
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  onClose: () => void;
  labelledBy: string;
  peek: ReactNode;
  children: ReactNode;
  expandLabel: string;
  collapseLabel: string;
  // Reports how much of the sheet covers the map, so floating map controls
  // can move above it.
  onVisibleHeightChange?: (px: number) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [fullH, setFullH] = useState(0);
  const [peekH, setPeekH] = useState(0);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startT: number; base: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const peekEl = peekRef.current;
    if (!sheet || !peekEl) return;
    const measure = () => {
      setFullH(sheet.clientHeight);
      setPeekH(peekEl.offsetHeight + HANDLE_PX);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sheet);
    ro.observe(peekEl);
    return () => ro.disconnect();
  }, [open]);

  const visibleFor = useCallback(
    (s: SheetSnap) => {
      if (s === "full") return fullH;
      if (s === "half") return Math.min(fullH, Math.max(peekH, Math.round(fullH * 0.62)));
      return Math.min(fullH, peekH);
    },
    [fullH, peekH],
  );

  const baseOffset = fullH - visibleFor(snap);
  const offset = dragOffset ?? baseOffset;

  useEffect(() => {
    if (open && fullH > 0) onVisibleHeightChange?.(visibleFor(snap));
    if (!open) onVisibleHeightChange?.(0);
  }, [open, snap, fullH, visibleFor, onVisibleHeightChange]);

  // Focus the sheet's heading when it opens; give focus back on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const heading = document.getElementById(labelledBy);
    heading?.focus({ preventScroll: true });
    return () => {
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open, labelledBy]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    drag.current = { startY: e.clientY, startT: e.timeStamp, base: baseOffset, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setDragOffset(Math.max(0, d.base + dy));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const dy = e.clientY - d.startY;
    const velocity = dy / Math.max(1, e.timeStamp - d.startT);
    const visible = fullH - Math.max(0, d.base + dy);
    setDragOffset(null);

    if (visible < visibleFor("peek") - CLOSE_OVERSHOOT_PX) return onClose();

    const current = ORDER.indexOf(snap);
    let next: SheetSnap;
    if (velocity > FLICK_VELOCITY) next = ORDER[Math.max(0, current - 1)];
    else if (velocity < -FLICK_VELOCITY) next = ORDER[Math.min(ORDER.length - 1, current + 1)];
    else next = ORDER.reduce((best, s) => (Math.abs(visibleFor(s) - visible) < Math.abs(visibleFor(best) - visible) ? s : best));
    if (next === snap && velocity > FLICK_VELOCITY && snap === "peek") return onClose();
    onSnapChange(next);
  }

  // A drag that ended over a button must not also click it.
  function onClickCapture(e: React.MouseEvent) {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  if (!open) return null;

  const expanded = snap !== "peek";

  return (
    <section
      ref={sheetRef}
      role="dialog"
      aria-modal={false}
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed inset-x-0 bottom-(--nav-h) z-30 flex h-[calc(100dvh-var(--nav-h)-var(--safe-top)-4.5rem)] flex-col rounded-t-3xl border border-b-0 bg-background shadow-[0_-8px_30px_rgba(15,23,42,0.14)]",
        "sm:inset-x-auto sm:left-4 sm:w-[420px]",
        dragOffset === null && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        fullH === 0 && "invisible",
      )}
      style={{ transform: `translate3d(0, ${offset}px, 0)` }}
    >
      <div
        className="shrink-0 touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <button
          type="button"
          aria-label={expanded ? collapseLabel : expandLabel}
          aria-expanded={expanded}
          onClick={() => onSnapChange(expanded ? "peek" : "full")}
          className="flex h-5 w-full cursor-grab items-center justify-center rounded-t-3xl focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
        </button>
        <div ref={peekRef}>{peek}</div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overscroll-contain pb-8",
          expanded ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        {children}
      </div>
    </section>
  );
}
