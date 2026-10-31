import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { computeAccessStatus, type AccessStatus } from "@/lib/access";
import { accessQueryOptions } from "@/hooks/use-access";
import { extendClient, listClients, setClientStatus, setupClient, type ClientRow } from "@/lib/admin.functions";

const clientsQuery = queryOptions({ queryKey: ["admin-clients"], queryFn: () => listClients() });

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Job Search Copilot" },
      { name: "description", content: "Manage client access to the Copilot." },
      { property: "og:title", content: "Admin — Job Search Copilot" },
      { property: "og:description", content: "Manage client access to the Copilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Admin rights alone open this page; no client program is needed.
  loader: async ({ context }) => {
    const view = await context.queryClient.ensureQueryData(accessQueryOptions);
    if (!view.isAdmin) throw redirect({ to: "/dashboard" });
    await context.queryClient.ensureQueryData(clientsQuery);
  },
  component: Admin,
});

const badge: Record<AccessStatus, string> = {
  active: "bg-success/15 text-success",
  upcoming: "bg-accent/20 text-accent-foreground",
  expired: "bg-muted text-muted-foreground",
  suspended: "bg-warning/20 text-foreground",
  revoked: "bg-destructive/15 text-destructive",
};
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const toIso = (day: string) => new Date(`${day}T00:00:00Z`).toISOString();
const toDay = (iso: string) => iso.slice(0, 10);

type Form = { email: string; fullName: string; programName: string; start: string; end: string };
const blank = (): Form => {
  const t = new Date();
  const e = new Date(t.getTime() + 90 * 86_400_000);
  return { email: "", fullName: "", programName: "", start: toDay(t.toISOString()), end: toDay(e.toISOString()) };
};

function Admin() {
  const qc = useQueryClient();
  const { data: clients } = useSuspenseQuery(clientsQuery);
  const setup = useServerFn(setupClient);
  const extend = useServerFn(extendClient);
  const status = useServerFn(setClientStatus);
  const [form, setForm] = useState<Form | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-clients"] });
  const fail = (e: unknown) => setNote({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });

  const save = useMutation({
    mutationFn: (f: Form) =>
      setup({ data: { email: f.email, fullName: f.fullName, programName: f.programName, startsAt: toIso(f.start), endsAt: toIso(f.end) } }),
    onSuccess: (r) => {
      setForm(null);
      setNote({
        ok: r.invite !== "failed",
        text: r.renewed
          ? "Program renewed on the existing client record."
          : r.invite === "sent"
            ? "Client added and invitation email sent."
            : r.invite === "existing"
              ? "Client added. They already have an account and can sign in now."
              : "Client added, but the invitation email could not be sent. Add them under Supabase → Users → Invite.",
      });
      refresh();
    },
    onError: fail,
  });
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      setNote(null);
      refresh();
    },
    onError: fail,
  });

  const renew = (c: ClientRow) =>
    setForm({ email: c.email, fullName: c.fullName, programName: c.programName, start: toDay(new Date().toISOString()), end: toDay(c.endsAt) });
  const onExtend = (c: ClientRow) => {
    const v = window.prompt(`New end date for ${c.fullName} (YYYY-MM-DD, UTC)`, toDay(c.endsAt));
    if (!v) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return fail(new Error("Use the format YYYY-MM-DD."));
    act.mutate(() => extend({ data: { id: c.id, endsAt: toIso(v) } }));
  };
  const onStatus = (c: ClientRow, s: ClientRow["status"]) => {
    if (s === "revoked" && !window.confirm(`Revoke ${c.fullName}'s access?`)) return;
    act.mutate(() => status({ data: { id: c.id, status: s } }));
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Administrator</p>
          <h1 className="mt-2 text-4xl font-medium">Clients</h1>
        </div>
        <button className="btn-primary" onClick={() => setForm(blank())}>Invite client</button>
      </div>

      {note && (
        <p role="status" className={`mt-6 rounded-md px-4 py-3 text-sm ${note.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
          {note.text}
        </p>
      )}

      {form && (
        <form
          className="panel mt-6 grid gap-4 p-6 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          {([
            ["email", "Email", "email"],
            ["fullName", "Full name", "text"],
            ["programName", "Program", "text"],
          ] as const).map(([k, label, type]) => (
            <label key={k} className="text-sm">
              <span className="font-semibold">{label}</span>
              <input required type={type} maxLength={k === "email" ? 255 : 120} className="field mt-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm"><span className="font-semibold">Start (UTC)</span>
              <input required type="date" className="field mt-1" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
            <label className="text-sm"><span className="font-semibold">End (UTC)</span>
              <input required type="date" className="field mt-1" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save client"}</button>
            <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{["Client", "Program", "Start (UTC)", "End (UTC)", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No clients yet. Use “Invite client” to add the first one.</td></tr>
            )}
            {clients.map((c) => {
              const s = computeAccessStatus(c);
              return (
                <tr key={c.id}>
                  <td className="px-5 py-4"><div className="font-semibold">{c.fullName}</div><div className="text-muted-foreground">{c.email}{c.linked ? "" : " · not signed in yet"}</div></td>
                  <td className="px-5 py-4">{c.programName}</td>
                  <td className="px-5 py-4">{fmt(c.startsAt)}</td>
                  <td className="px-5 py-4">{fmt(c.endsAt)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badge[s]}`}>{s}</span></td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button className="btn-ghost" disabled={act.isPending} onClick={() => onExtend(c)}>Extend</button>
                    <button className="btn-ghost" disabled={act.isPending} onClick={() => renew(c)}>Renew</button>
                    {c.status === "active" ? (
                      <button className="btn-ghost" disabled={act.isPending} onClick={() => onStatus(c, "suspended")}>Suspend</button>
                    ) : (
                      <button className="btn-ghost" disabled={act.isPending} onClick={() => onStatus(c, "active")}>Reactivate</button>
                    )}
                    {c.status !== "revoked" && (
                      <button className="btn-ghost text-destructive" disabled={act.isPending} onClick={() => onStatus(c, "revoked")}>Revoke</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
