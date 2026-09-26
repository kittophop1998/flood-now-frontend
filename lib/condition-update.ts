// Turns the "update the situation" dialog's values into the condition update
// sent with a still_active confirmation (docs/api-spec.md): only what differs
// from what the report shows now, and only fields its category has.
import { CATEGORY_META, hasKnownPassability } from "@/lib/report-meta";
import { VEHICLES, type ConditionUpdate, type Passability, type Report, type Severity, type WaterDepth } from "@/types/report";

export const UNKNOWN_PASSABILITY: Passability = { walk: "unknown", motorcycle: "unknown", sedan: "unknown", suv_pickup: "unknown" };

export interface ConditionDraft {
  severity: Severity;
  water_depth: WaterDepth | null;
  passability: Passability;
  // Key of a photo already uploaded (presign → R2) in the dialog.
  image_key: string | null;
}

export function conditionDraftFrom(report: Report): ConditionDraft {
  return {
    severity: report.severity,
    water_depth: report.water_depth,
    passability: report.passability ?? UNKNOWN_PASSABILITY,
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
  if (draft.image_key) out.image_key = draft.image_key;
  return out;
}

// A report without passability reads the same as one where every vehicle is
// "unknown".
function samePassability(a: Passability, b: Passability | null): boolean {
  if (!hasKnownPassability(b)) return !hasKnownPassability(a);
  return VEHICLES.every((v) => a[v] === b[v]);
}
