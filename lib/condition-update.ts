// Turns the "update the situation" dialog's values into the condition update
// sent with a still_active confirmation (docs/api-spec.md): only what differs
// from what the report shows now, and only fields its category has.
import { CATEGORY_META, hasKnownPassability, knownDetails } from "@/lib/report-meta";
import { VEHICLES, type ConditionUpdate, type Passability, type Report, type ReportDetails, type Severity, type WaterDepth } from "@/types/report";

export const UNKNOWN_PASSABILITY: Passability = { walk: "unknown", motorcycle: "unknown", sedan: "unknown", suv_pickup: "unknown" };

export interface ConditionDraft {
  severity: Severity;
  water_depth: WaterDepth | null;
  passability: Passability;
  details: ReportDetails;
  // Key of a photo already uploaded (presign → R2) in the dialog.
  image_key: string | null;
}

export function conditionDraftFrom(report: Report): ConditionDraft {
  return {
    severity: report.severity,
    water_depth: report.water_depth,
    passability: report.passability ?? UNKNOWN_PASSABILITY,
    details: { ...report.details },
    image_key: null,
  };
}

export function conditionChanges(report: Report, draft: ConditionDraft): ConditionUpdate {
  const fields = CATEGORY_META[report.type].fields;
  const out: ConditionUpdate = {};
  if (draft.severity !== report.severity) out.severity = draft.severity;
  if (fields.waterDepth && draft.water_depth && draft.water_depth !== report.water_depth) {
    out.water_depth = draft.water_depth;
  }
  if (fields.passability && !samePassability(draft.passability, report.passability)) {
    out.passability = draft.passability;
  }
  // Details merge server-side, so only newly set/changed values are sent (a
  // cleared chip keeps the previous value rather than erasing it).
  const current = report.details ?? {};
  const changed = knownDetails(report.type, draft.details).filter(([f, v]) => current[f.key] !== v);
  if (changed.length > 0) out.details = Object.fromEntries(changed.map(([f, v]) => [f.key, v]));
  if (draft.image_key) out.image_key = draft.image_key;
  return out;
}

// A report without passability reads the same as one where every vehicle is
// "unknown".
function samePassability(a: Passability, b: Passability | null): boolean {
  if (!hasKnownPassability(b)) return !hasKnownPassability(a);
  return VEHICLES.every((v) => a[v] === b[v]);
}
