import { test } from "node:test";
import assert from "node:assert/strict";
import { collapsedIdsAfterMinimize, isBannerCollapsed } from "@/lib/announcement-banner";

test("banner starts expanded until minimized", () => {
  assert.equal(isBannerCollapsed(["a"], null), false);
});

test("banner stays minimized while it shows only already-seen announcements", () => {
  const stored = collapsedIdsAfterMinimize(["a", "b"], null);
  assert.equal(isBannerCollapsed(["a", "b"], stored), true);
  assert.equal(isBannerCollapsed(["b"], stored), true);
});

test("a new announcement reopens a minimized banner", () => {
  const stored = collapsedIdsAfterMinimize(["a", "b"], null);
  assert.equal(isBannerCollapsed(["a", "c"], stored), false);
});

test("minimizing again keeps earlier dismissed ids, current ones first", () => {
  assert.deepEqual(collapsedIdsAfterMinimize(["c", "a"], ["a", "b"]), ["c", "a", "b"]);
  const many = Array.from({ length: 150 }, (_, i) => `id${i}`);
  assert.equal(collapsedIdsAfterMinimize(["x"], many).length, 100);
});
