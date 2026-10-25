import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeAccessStatus, type AccessStatus } from "./access";

export type AccessView =
  | { kind: "none"; isAdmin: boolean }
  | {
      kind: "record";
      status: AccessStatus;
      fullName: string;
      programName: string;
      startsAt: string;
      endsAt: string;
      isAdmin: boolean;
    };

const COLUMNS = "full_name, program_name, starts_at, ends_at, status";

/**
 * Who is the signed-in person, and is their program active?
 *
 * The status is computed by computeAccessStatus (src/lib/access.ts) — the one
 * place the active / upcoming / expired rule lives.
 */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessView> => {
    const { supabase, userId, claims } = context;

    // Admins table has a read-own-row policy, so this returns a row only for staff.
    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = Boolean(adminRow);

    let { data: row, error } = await supabase
      .from("client_access")
      .select(COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Could not read your access: ${error.message}`);

    // First sign-in: claim the invitation Coach Deepak created for this email.
    // The address comes from the verified auth token, never from the request,
    // and only an unclaimed row can be taken.
    const email =
      typeof (claims as { email?: unknown }).email === "string"
        ? String((claims as { email: string }).email).toLowerCase()
        : "";

    if (!row && email) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("client_access")
        .update({ user_id: userId })
        .eq("email", email)
        .is("user_id", null);

      ({ data: row, error } = await supabase
        .from("client_access")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle());
      if (error) throw new Error(`Could not read your access: ${error.message}`);
    }

    if (!row) return { kind: "none", isAdmin };

    return {
      kind: "record",
      status: computeAccessStatus({
        status: row.status,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }),
      fullName: row.full_name,
      programName: row.program_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isAdmin,
    };
  });
