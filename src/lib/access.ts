export type StoredStatus = "active" | "suspended" | "revoked";
export type AccessStatus = StoredStatus | "upcoming" | "expired";

/** Access allowed only when status is active and startsAt <= now < endsAt (UTC). */
export function computeAccessStatus(
  rec: { status: StoredStatus; startsAt: string; endsAt: string },
  now: Date = new Date(),
): AccessStatus {
  if (rec.status !== "active") return rec.status;
  const t = now.getTime();
  if (t < Date.parse(rec.startsAt)) return "upcoming";
  if (t >= Date.parse(rec.endsAt)) return "expired";
  return "active";
}

export const hasAccess = (rec: Parameters<typeof computeAccessStatus>[0], now?: Date) =>
  computeAccessStatus(rec, now) === "active";
