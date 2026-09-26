"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, EyeOff, Eye, Loader2, LogOut, RefreshCw, Trash2, CircleCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocaleToggle } from "@/components/locale-toggle";
import { OfficialBadge, PlaceStatusBadge, ToneBadge, UserAddedBadge } from "@/components/community/badges";
import { ReportSummary } from "@/components/report/report-card";
import { EmptyState } from "@/components/views/view-shell";
import { adminService } from "@/services/admin-service";
import { importantPlacesService } from "@/services/community-service";
import { ApiError } from "@/services/api-client";
import { useNow } from "@/features/common/use-now";
import { formatClockTime, formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_TYPES,
  IMPORTANT_PLACE_CATEGORIES,
  IMPORTANT_PLACE_STATUSES,
  type Announcement,
  type AnnouncementInput,
  type ImportantPlace,
  type ImportantPlaceInput,
  type ModerationAction,
  type ModerationItem,
} from "@/types/community";
import { SEVERITIES } from "@/types/report";

// Session-only: the operator token never goes to localStorage.
const TOKEN_KEY = "floodnow:admin-token";
// Thailand, for listing curated places.
const TH_BBOX = { minLat: 5.5, maxLat: 20.6, minLng: 97.3, maxLng: 105.7 };

type Tab = "moderation" | "announcements" | "places";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-background px-2.5 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.status !== 0 ? err.message : fallback;
}

// Minimal operator console. FloodNow has no user accounts; the API gates
// /api/v1/admin/* with the shared ADMIN_TOKEN, which the operator pastes here.
export default function AdminPage() {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("moderation");

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(TOKEN_KEY);
      // Restoring a session-only value after mount; nothing to derive at render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setToken(saved);
    } catch {
      // sessionStorage unavailable: sign in each time
    }
  }, []);

  async function signIn() {
    setChecking(true);
    setError(null);
    try {
      await adminService(input.trim()).queue();
      setToken(input.trim());
      try {
        window.sessionStorage.setItem(TOKEN_KEY, input.trim());
      } catch {
        // best-effort
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? t("adminDisabled") : err instanceof ApiError && err.status === 401 ? t("adminBadToken") : t("adminUnreachable"));
    } finally {
      setChecking(false);
    }
  }

  function signOut() {
    setToken(null);
    setInput("");
    try {
      window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // best-effort
    }
  }

  return (
    <main className="min-h-dvh bg-muted">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <Link href="/" aria-label={t("back")} className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-lg font-semibold">{t("adminTitle")}</h1>
        <LocaleToggle />
        {token && (
          <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label={t("adminSignOut")} onClick={signOut}>
            <LogOut className="size-5" />
          </Button>
        )}
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        {!token ? (
          <form
            className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <Label htmlFor="admin-token">{t("adminToken")}</Label>
            <Input id="admin-token" type="password" autoComplete="off" className="h-11 text-base" value={input} onChange={(e) => setInput(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("adminTokenHint")}</p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="h-11 rounded-xl" disabled={checking || !input.trim()}>
              {checking && <Loader2 className="animate-spin" aria-hidden />}
              {t("adminSignIn")}
            </Button>
          </form>
        ) : (
          <>
            <div role="tablist" aria-label={t("adminTitle")} className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1 shadow-xs">
              {(["moderation", "announcements", "places"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "min-h-11 rounded-lg px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                    tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t(id === "moderation" ? "adminModeration" : id === "announcements" ? "announcementsTitle" : "importantPlacesTitle")}
                </button>
              ))}
            </div>
            {tab === "moderation" && <ModerationPanel token={token} />}
            {tab === "announcements" && <AnnouncementsPanel token={token} />}
            {tab === "places" && <PlacesPanel token={token} />}
          </>
        )}
      </div>
    </main>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs", className)}>{children}</section>;
}

function ModerationPanel({ token }: { token: string }) {
  const { t } = useTranslation();
  const now = useNow();
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await adminService(token).queue());
    } catch (err) {
      setError(errorText(err, t("adminUnreachable")));
    }
  }, [token, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(reportId: string, action: ModerationAction) {
    setBusy(`${reportId}:${action}`);
    try {
      await adminService(token).moderate(reportId, action);
      toast.success(t("adminDone"));
      await load();
    } catch (err) {
      toast.error(errorText(err, t("adminUnreachable")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("adminQueueHint")}</p>
        <Button variant="outline" className="h-11 rounded-xl" onClick={load}>
          <RefreshCw aria-hidden />
          {t("adminRefresh")}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {items == null && !error && <div className="h-32 animate-pulse rounded-2xl bg-background" aria-hidden />}
      {items?.length === 0 && <EmptyState icon={<CircleCheck />} title={t("adminQueueEmpty")} />}
      {items?.map((it) => (
        <Card key={it.report.id} className={cn(it.report.hidden_at && "border-amber-400")}>
          <ReportSummary report={it.report} now={now} />
          <div className="flex flex-wrap items-center gap-1.5">
            {it.report.hidden_at ? (
              <ToneBadge icon={EyeOff} tone="warn">
                {t(it.report.hidden_reason === "auto_threshold" ? "adminHiddenAuto" : "adminHiddenManual")}
              </ToneBadge>
            ) : (
              <ToneBadge icon={Eye} tone="ok">
                {t("adminVisible")}
              </ToneBadge>
            )}
            <span className="text-sm font-semibold">{t("adminComplaintCount", { n: it.complaint_count })}</span>
            {Object.entries(it.reasons).map(([reason, n]) => (
              <span key={reason} className="rounded-full border px-2 py-0.5 text-xs">
                {t(`problemReason.${reason}` as "problemReason.other")} × {n}
              </span>
            ))}
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {it.complaints.map((c) => (
              <li key={c.id} className="rounded-lg bg-muted px-2.5 py-1.5">
                <span className="font-medium">{t(`problemReason.${c.reason}` as "problemReason.other")}</span>
                <span className="text-muted-foreground"> · {formatFreshness(c.created_at, t, now)}</span>
                {c.details && <p className="break-words">{c.details}</p>}
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-medium">{t("adminHistory")}</summary>
            <ul className="flex flex-col gap-0.5 pl-2 text-xs text-muted-foreground">
              {it.events.map((e, i) => (
                <li key={i}>
                  {e.kind} · {formatFreshness(e.created_at, t, now)}
                </li>
              ))}
            </ul>
          </details>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-xl" disabled={busy != null} onClick={() => act(it.report.id, "dismiss")}>
              {t("adminDismiss")}
            </Button>
            {it.report.hidden_at ? (
              <Button variant="outline" className="h-11 rounded-xl" disabled={busy != null} onClick={() => act(it.report.id, "unhide")}>
                <Eye aria-hidden />
                {t("adminUnhide")}
              </Button>
            ) : (
              <Button variant="destructive" className="h-11 rounded-xl" disabled={busy != null} onClick={() => act(it.report.id, "hide")}>
                <EyeOff aria-hidden />
                {t("adminHide")}
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function numberOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function AnnouncementsPanel({ token }: { token: string }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "flood_warning" as Announcement["type"],
    severity: "high" as Announcement["severity"],
    source_name: "",
    source_url: "",
    latitude: "",
    longitude: "",
    radius_m: "",
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: "",
    publish: false,
  });

  const load = useCallback(async () => {
    try {
      setItems(await adminService(token).announcements());
    } catch (err) {
      setError(errorText(err, t("adminUnreachable")));
    }
  }, [token, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create() {
    setSaving(true);
    setError(null);
    const input: AnnouncementInput = {
      title: form.title,
      body: form.body,
      type: form.type,
      severity: form.severity,
      source_name: form.source_name,
      source_url: form.source_url || undefined,
      latitude: numberOrUndefined(form.latitude),
      longitude: numberOrUndefined(form.longitude),
      radius_m: numberOrUndefined(form.radius_m),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : undefined,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : undefined,
      publish: form.publish,
    };
    try {
      await adminService(token).createAnnouncement(input);
      toast.success(t("adminDone"));
      setForm((f) => ({ ...f, title: "", body: "", source_url: "", latitude: "", longitude: "", radius_m: "", ends_at: "" }));
      await load();
    } catch (err) {
      setError(errorText(err, t("adminUnreachable")));
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await load();
    } catch (err) {
      toast.error(errorText(err, t("adminUnreachable")));
    }
  }

  const field = (key: keyof typeof form, label: string, props: Partial<React.ComponentProps<"input">> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ann-${key}`}>{label}</Label>
      <Input
        id={`ann-${key}`}
        className="h-11 text-base"
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <h2 className="font-semibold">{t("adminNewAnnouncement")}</h2>
        {field("title", t("adminFieldTitle"), { maxLength: 200 })}
        <div className="grid gap-1.5">
          <Label htmlFor="ann-body">{t("adminFieldBody")}</Label>
          <Textarea id="ann-body" rows={4} maxLength={5000} className="text-base" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ann-type">{t("announcementType")}</Label>
            <select id="ann-type" className={selectClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Announcement["type"] })}>
              {ANNOUNCEMENT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {t(`annType.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ann-severity">{t("severityHeading")}</Label>
            <select id="ann-severity" className={selectClass} value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Announcement["severity"] })}>
              {SEVERITIES.map((v) => (
                <option key={v} value={v}>
                  {t(`severity.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {field("source_name", t("adminFieldSource"), { maxLength: 200 })}
        {field("source_url", t("adminFieldSourceUrl"), { type: "url", placeholder: "https://" })}
        <div className="grid grid-cols-3 gap-2">
          {field("latitude", t("adminFieldLat"), { inputMode: "decimal" })}
          {field("longitude", t("adminFieldLng"), { inputMode: "decimal" })}
          {field("radius_m", t("adminFieldRadius"), { inputMode: "numeric" })}
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          {field("starts_at", t("announcementStarts"), { type: "datetime-local" })}
          {field("ends_at", t("announcementEnds"), { type: "datetime-local" })}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
          {t("adminPublishNow")}
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="h-11 rounded-xl" onClick={create} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {t("adminCreate")}
        </Button>
      </Card>

      {items?.map((a) => (
        <Card key={a.id}>
          <div className="flex flex-wrap items-center gap-1.5">
            <OfficialBadge />
            <span className="rounded-full border px-2 py-0.5 text-xs font-semibold">{t(`adminStatus.${a.status}`)}</span>
            <span className="text-xs text-muted-foreground">{formatClockTime(a.starts_at, locale, now)}</span>
          </div>
          <p className="font-semibold">{a.title}</p>
          <p className="text-xs text-muted-foreground">{a.source_name}</p>
          <div className="flex flex-wrap gap-2">
            {a.published_at ? (
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => run(() => adminService(token).setPublished(a.id, false))}>
                {t("adminUnpublish")}
              </Button>
            ) : (
              <Button className="h-11 rounded-xl" onClick={() => run(() => adminService(token).setPublished(a.id, true))}>
                <ShieldCheck aria-hidden />
                {t("adminPublish")}
              </Button>
            )}
            {a.status !== "expired" && (
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => run(() => adminService(token).updateAnnouncement(a.id, { ends_at: new Date().toISOString() }))}>
                {t("adminEndNow")}
              </Button>
            )}
            <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => run(() => adminService(token).deleteAnnouncement(a.id))}>
              <Trash2 aria-hidden />
              {t("delete")}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PlacesPanel({ token }: { token: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ImportantPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const empty = { name: "", category: "shelter" as ImportantPlace["category"], status: "open" as ImportantPlace["status"], latitude: "", longitude: "", address: "", contact: "", source: "", description: "" };
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    try {
      setItems((await importantPlacesService.list({ bbox: TH_BBOX })).places);
    } catch (err) {
      setError(errorText(err, t("adminUnreachable")));
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create() {
    setSaving(true);
    setError(null);
    const input: ImportantPlaceInput = {
      name: form.name,
      category: form.category,
      status: form.status,
      latitude: numberOrUndefined(form.latitude),
      longitude: numberOrUndefined(form.longitude),
      address: form.address || undefined,
      contact: form.contact || undefined,
      source: form.source || undefined,
      description: form.description || undefined,
    };
    try {
      await adminService(token).createPlace(input);
      toast.success(t("adminDone"));
      setForm(empty);
      await load();
    } catch (err) {
      setError(errorText(err, t("adminUnreachable")));
    } finally {
      setSaving(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await load();
    } catch (err) {
      toast.error(errorText(err, t("adminUnreachable")));
    }
  }

  const field = (key: keyof typeof empty, label: string, props: Partial<React.ComponentProps<"input">> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ip-${key}`}>{label}</Label>
      <Input id={`ip-${key}`} className="h-11 text-base" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <h2 className="font-semibold">{t("adminNewPlace")}</h2>
        {field("name", t("placeNameLabel"), { maxLength: 120 })}
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ip-category">{t("filterCategories")}</Label>
            <select id="ip-category" className={selectClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ImportantPlace["category"] })}>
              {IMPORTANT_PLACE_CATEGORIES.map((v) => (
                <option key={v} value={v}>
                  {t(`ipCategory.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ip-status">{t("filterStatus")}</Label>
            <select id="ip-status" className={selectClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ImportantPlace["status"] })}>
              {IMPORTANT_PLACE_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {t(`ipStatus.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {field("latitude", t("adminFieldLat"), { inputMode: "decimal" })}
          {field("longitude", t("adminFieldLng"), { inputMode: "decimal" })}
        </div>
        {field("address", t("ipAddress"), { maxLength: 300 })}
        {field("contact", t("contactLabel"), { maxLength: 120 })}
        {field("source", t("ipSource"), { maxLength: 200 })}
        {field("description", t("descriptionHeading"), { maxLength: 2000 })}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="h-11 rounded-xl" onClick={create} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {t("adminCreate")}
        </Button>
      </Card>

      {items?.map((p) => (
        <Card key={p.id}>
          <div className="flex flex-wrap items-center gap-1.5">
            <PlaceStatusBadge status={p.status} />
            {p.origin === "community" && <UserAddedBadge />}
            <span className="text-xs text-muted-foreground">{t(`ipCategory.${p.category}`)}</span>
          </div>
          <p className="font-semibold">{p.name}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t("filterStatus")}
              className={cn(selectClass, "w-auto")}
              value={p.status}
              onChange={(e) => run(() => adminService(token).updatePlace(p.id, { status: e.target.value as ImportantPlace["status"] }))}
            >
              {IMPORTANT_PLACE_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {t(`ipStatus.${v}`)}
                </option>
              ))}
            </select>
            <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => run(() => adminService(token).deletePlace(p.id))}>
              <Trash2 aria-hidden />
              {t("delete")}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
