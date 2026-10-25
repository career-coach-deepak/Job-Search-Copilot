import { describe, expect, it } from "vitest";
import { isBlocked } from "@/hooks/use-access";
import type { AccessView } from "@/lib/access.functions";

function record(status: "active" | "upcoming" | "expired"): AccessView {
  return {
    kind: "record",
    status,
    fullName: "Priya Sharma",
    programName: "Executive Career Pivot",
    startsAt: "2026-01-01T00:00:00Z",
    endsAt: "2026-04-01T00:00:00Z",
    isAdmin: false,
  };
}

describe("copilot access gate", () => {
  it("lets an active client through", () => {
    expect(isBlocked(record("active"))).toBe(false);
  });
  it("blocks someone with no access record", () => {
    expect(isBlocked({ kind: "none", isAdmin: false })).toBe(true);
  });
  it("blocks a client whose program has not started", () => {
    expect(isBlocked(record("upcoming"))).toBe(true);
  });
  it("blocks a client whose program has ended", () => {
    expect(isBlocked(record("expired"))).toBe(true);
  });
  it("blocks while the access check is still loading", () => {
    expect(isBlocked(undefined)).toBe(true);
  });
});
