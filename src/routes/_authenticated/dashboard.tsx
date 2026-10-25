import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { capabilities, demoConversations } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Job Search Copilot" },
      { name: "description", content: "Your coaching program and recent Copilot conversations." },
      { property: "og:title", content: "Dashboard — Job Search Copilot" },
      { property: "og:description", content: "Your coaching program and recent Copilot conversations." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 text-4xl font-medium">Good to see you, Priya.</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="panel bg-ink-gradient p-6 text-ink-foreground md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-ink-foreground/60">Your program</p>
          <h2 className="mt-2 text-2xl">Executive Career Pivot</h2>
          <p className="mt-1 text-sm text-ink-foreground/70">Access until 1 Dec 2026 · 37 days left</p>
          <Link to="/chat" className="btn-accent mt-6">Open the Copilot</Link>
        </div>
        <div className="panel p-6">
          <p className="text-sm font-semibold">Ask the Copilot about</p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {capabilities.map((c) => <li key={c}>— {c}</li>)}
          </ul>
        </div>
      </div>
      <h2 className="mt-12 text-xl font-medium">Recent conversations</h2>
      <ul className="panel mt-4 divide-y divide-border">
        {demoConversations.map((c) => (
          <li key={c.id}>
            <Link to="/chat" className="flex justify-between px-5 py-4 text-sm hover:bg-secondary">
              <span>{c.title}</span><span className="text-muted-foreground">{c.updated}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-muted-foreground">
        Preview the <Link to="/access-ended" className="underline">access ended</Link> screen.
      </p>
    </AppShell>
  );
}
