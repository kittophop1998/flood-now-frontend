export function formatFreshness(lastVerifiedAt: string, now: Date = new Date()): string {
  const verified = new Date(lastVerifiedAt);
  const diffMs = now.getTime() - verified.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
