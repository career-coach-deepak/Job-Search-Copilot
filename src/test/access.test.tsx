import { describe, expect, it } from "vitest";
import { computeAccessStatus } from "@/lib/access";

const rec = { status: "active" as const, startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-04-01T00:00:00Z" };

describe("access rule", () => {
  it("allows at exactly the start time", () => {
    expect(computeAccessStatus(rec, new Date("2026-01-01T00:00:00Z"))).toBe("active");
  });
  it("denies at exactly the end time", () => {
    expect(computeAccessStatus(rec, new Date("2026-04-01T00:00:00Z"))).toBe("expired");
  });
  it("is upcoming before start", () => {
    expect(computeAccessStatus(rec, new Date("2025-12-31T23:59:59Z"))).toBe("upcoming");
  });
  it("denies suspended even inside the date range", () => {
    expect(computeAccessStatus({ ...rec, status: "suspended" }, new Date("2026-02-01T00:00:00Z"))).toBe("suspended");
  });
  it("denies revoked even inside the date range", () => {
    expect(computeAccessStatus({ ...rec, status: "revoked" }, new Date("2026-02-01T00:00:00Z"))).toBe("revoked");
  });
});
