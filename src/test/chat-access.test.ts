import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), adminFrom: vi.fn(), owner: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.adminFrom } }));
import { listConversations } from "@/lib/chat.functions";

const call = listConversations as unknown as (args: { context: unknown }) => Promise<unknown>;
const context = {
  userId: "verified-user",
  supabase: { from: () => ({ select: () => ({ eq: mocks.owner }) }) },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockReturnValue({ maybeSingle: mocks.lookup });
  mocks.adminFrom.mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) });
});

describe("Copilot server access", () => {
  it.each(["suspended", "revoked"])("denies %s clients before reading conversations", async (status) => {
    mocks.lookup.mockResolvedValue({ data: { status, starts_at: "2020-01-01", ends_at: "2099-01-01" }, error: null });
    await expect(call({ context })).rejects.toThrow("not active");
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it.each([
    ["upcoming", "2098-01-01", "2099-01-01"],
    ["expired", "2020-01-01", "2021-01-01"],
  ])("denies %s clients", async (_, starts_at, ends_at) => {
    mocks.lookup.mockResolvedValue({ data: { status: "active", starts_at, ends_at }, error: null });
    await expect(call({ context })).rejects.toThrow("not active");
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it("denies unapproved clients", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    await expect(call({ context })).rejects.toThrow("not active");
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it("fails closed when the access lookup fails", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: { code: "42501" } });
    await expect(call({ context })).rejects.toThrow("Could not check");
    expect(mocks.adminFrom).not.toHaveBeenCalled();
  });
  it("loads an empty history for an active verified client", async () => {
    mocks.lookup.mockResolvedValue({ data: { status: "active", starts_at: "2020-01-01", ends_at: "2099-01-01" }, error: null });
    await expect(call({ context })).resolves.toEqual([]);
    expect(mocks.owner).toHaveBeenCalledWith("user_id", "verified-user");
    expect(mocks.adminFrom).toHaveBeenCalledWith("conversations");
  });
});