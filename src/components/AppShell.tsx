import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyAccess } from "@/hooks/use-access";

export function Brand() {
  return (
    <Link to="/" className="flex items-baseline gap-2">
      <span className="font-display text-lg font-semibold">Job Search Copilot</span>
      <span className="text-xs text-muted-foreground">by Coach Deepak</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: access } = useMyAccess();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Brand />
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/dashboard" className="btn-ghost" activeProps={{ className: "bg-secondary" }}>
              Dashboard
            </Link>
            <Link to="/chat" className="btn-ghost" activeProps={{ className: "bg-secondary" }}>
              Copilot
            </Link>
            {access?.isAdmin && (
              <Link to="/admin" className="btn-ghost" activeProps={{ className: "bg-secondary" }}>
                Admin
              </Link>
            )}
            <button type="button" onClick={signOut} className="btn-outline ml-2">
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
