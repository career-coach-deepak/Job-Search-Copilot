import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Brand() {
  return (
    <Link to="/" className="flex items-baseline gap-2">
      <span className="font-display text-lg font-semibold">Job Search Copilot</span>
      <span className="text-xs text-muted-foreground">by Coach Deepak</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Brand />
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/dashboard" className="btn-ghost" activeProps={{ className: "bg-secondary" }}>Dashboard</Link>
            <Link to="/chat" className="btn-ghost" activeProps={{ className: "bg-secondary" }}>Copilot</Link>
            <Link to="/admin" className="btn-ghost" activeProps={{ className: "bg-secondary" }}>Admin</Link>
            <Link to="/" className="btn-outline ml-2">Sign out</Link>
          </nav>
        </div>
      </header>
      <div className="bg-accent/15 px-6 py-1.5 text-center text-xs text-muted-foreground">
        Preview with sample data — sign-in and AI are not connected yet.
      </div>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
