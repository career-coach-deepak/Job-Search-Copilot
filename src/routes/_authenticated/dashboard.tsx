import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { accessQueryOptions, isBlocked } from "@/hooks/use-access";
import { capabilities } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Job Search Copilot" },
      { name: "description", content: "Your coaching program and your Copilot." },
      { property: "og:title", content: "Dashboard — Job Search Copilot" },
      { property: "og:description", content: "Your coaching program and your Copilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    const view = await context.queryClient.ensureQueryData(accessQueryOptions);
    // Coaching staff without their own client program go to the admin area.
    if (isBlocked(view)) throw redirect({ to: view.isAdmin ? "/admin" : "/access-ended" });
  },
  component: Dashboard,
});

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const daysLeft = (endsAt: string) =>
  Math.max(0, Math.ceil((Date.parse(endsAt) - Date.now()) / 86_400_000));

function Dashboard() {
  const { data: view } = useSuspenseQuery(accessQueryOptions);
  if (view.kind !== "record") return null;

  const firstName = view.fullName.trim().split(/\s+/)[0] || "there";

  return (
    <AppShell>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 text-4xl font-medium">Good to see you, {firstName}.</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="panel bg-ink-gradient p-6 text-ink-foreground md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-ink-foreground/60">Your program</p>
          <h2 className="mt-2 text-2xl">{view.programName || "Coaching program"}</h2>
          <p className="mt-1 text-sm text-ink-foreground/70">
            Access until {fmt(view.endsAt)} · {daysLeft(view.endsAt)} days left
          </p>
          <Link to="/chat" className="btn-accent mt-6">Open the Copilot</Link>
        </div>
        <div className="panel p-6">
          <p className="text-sm font-semibold">Ask the Copilot about</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {capabilities.map((c) => <li key={c}>— {c}</li>)}
          </ul>
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Your program started {fmt(view.startsAt)}. Conversations are saved to your own private history.
      </p>
    </AppShell>
  );
}
