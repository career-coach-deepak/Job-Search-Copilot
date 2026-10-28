import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

/** Every admin action re-checks staff rights on the server, as the caller. */
async function assertAdmin({ supabase, userId }: Ctx) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error || data !== true) throw new Error("Only the coach can manage clients.");
}

export type ClientRow = {
  id: string;
  email: string;
  fullName: string;
  programName: string;
  startsAt: string;
  endsAt: string;
  status: "active" | "suspended" | "revoked";
  linked: boolean;
};

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientRow[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("client_access")
      .select("id, email, full_name, program_name, starts_at, ends_at, status, user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not load clients: ${error.message}`);
    return data.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      programName: r.program_name,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      status: r.status,
      linked: r.user_id !== null,
    }));
  });

const setupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    fullName: z.string().trim().min(1).max(120),
    programName: z.string().trim().min(1).max(120),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: "End date must be after the start date." });

/**
 * Invite a new client, or renew an existing one. One row per email: a renewal
 * updates that row (new dates, status back to active) instead of adding one.
 */
export const setupClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setupSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase } = context;
    const fields = {
      full_name: data.fullName,
      program_name: data.programName,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      status: "active" as const,
    };
    const { data: existing } = await supabase.from("client_access").select("id").eq("email", data.email).maybeSingle();
    const res = existing
      ? await supabase.from("client_access").update(fields).eq("id", existing.id)
      : await supabase.from("client_access").insert({ ...fields, email: data.email });
    if (res.error) throw new Error(`Could not save client: ${res.error.message}`);

    // Public sign-ups are off, so the coach's invite creates the sign-in account.
    let invite: "sent" | "existing" | "failed" = "existing";
    if (!existing) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const origin = getRequestHeader("origin") ?? undefined;
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        origin ? { redirectTo: `${origin}/dashboard` } : {},
      );
      if (!error) invite = "sent";
      else if (/already been registered|already exists/i.test(error.message)) invite = "existing";
      else {
        console.error("invite failed", error.message);
        invite = "failed";
      }
    }
    return { renewed: Boolean(existing), invite };
  });

const idSchema = z.string().uuid();

export const extendClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: idSchema, endsAt: z.string().datetime() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("client_access").update({ ends_at: data.endsAt }).eq("id", data.id);
    if (error) throw new Error(`Could not extend: ${error.message}`);
    return { ok: true };
  });

export const setClientStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: idSchema, status: z.enum(["active", "suspended", "revoked"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("client_access").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(`Could not update status: ${error.message}`);
    return { ok: true };
  });
