import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { computeAccessStatus, type AccessStatus } from "@/lib/access";
import { demoClients } from "@/lib/demo-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Job Search Copilot" },
      { name: "description", content: "Manage client access to the Copilot." },
      { property: "og:title", content: "Admin — Job Search Copilot" },
      { property: "og:description", content: "Manage client access to the Copilot." },
    ],
  }),
  component: Admin,
});

const badge: Record<AccessStatus, string> = {
  active: "bg-success/15 text-success",
  upcoming: "bg-accent/20 text-accent-foreground",
  expired: "bg-muted text-muted-foreground",
  suspended: "bg-warning/20 text-foreground",
  revoked: "bg-destructive/15 text-destructive",
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Admin() {
  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Administrator</p>
          <h1 className="mt-2 text-4xl font-medium">Clients</h1>
        </div>
        <button className="btn-primary" disabled title="Available in stage 5">Invite client</button>
      </div>
      <div className="panel mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{["Client", "Program", "Start (UTC)", "End (UTC)", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {demoClients.map((c) => {
              const s = computeAccessStatus(c);
              return (
                <tr key={c.email}>
                  <td className="px-5 py-4"><div className="font-semibold">{c.name}</div><div className="text-muted-foreground">{c.email}</div></td>
                  <td className="px-5 py-4">{c.program}</td>
                  <td className="px-5 py-4">{fmt(c.startsAt)}</td>
                  <td className="px-5 py-4">{fmt(c.endsAt)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badge[s]}`}>{s}</span></td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <button className="btn-ghost" disabled>Extend</button>
                    <button className="btn-ghost" disabled>{c.status === "suspended" ? "Reactivate" : "Suspend"}</button>
                    <button className="btn-ghost text-destructive" disabled>Revoke</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Sample clients. Actions activate once the database is connected.</p>
    </AppShell>
  );
}
