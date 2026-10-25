import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Brand } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { accessQueryOptions, useMyAccess } from "@/hooks/use-access";
import type { AccessStatus } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/access-ended")({
  head: () => ({
    meta: [
      { title: "Access ended — Job Search Copilot" },
      { name: "description", content: "Your Copilot access is not currently active." },
      { property: "og:title", content: "Access ended — Job Search Copilot" },
      { property: "og:description", content: "Your Copilot access is not currently active." },
    ],
  }),
  loader: async ({ context }) => {
    const view = await context.queryClient.ensureQueryData(accessQueryOptions);
    if (view.kind === "record" && view.status === "active") throw redirect({ to: "/dashboard" });
    if (view.isAdmin) throw redirect({ to: "/admin" });
  },
  component: AccessEnded,
});

// Every reason a signed-in person may not use the Copilot ("active" is handled
// by the loader, which sends those people to the dashboard).
type AccessReason = Exclude<AccessStatus, "active"> | "none";

const copy: Record<AccessReason, { title: string; body: string }> = {
  none: {
    title: "No access record yet",
    body: "We've signed you in, but your email isn't on Coach Deepak's client list yet. Ask him to add you and try again.",
  },
  upcoming: {
    title: "Your program hasn't started yet",
    body: "Your access is set up and waiting. The Copilot opens on your start date.",
  },
  expired: {
    title: "Your access has ended",
    body: "Your coaching program's end date has passed, so the Copilot and your conversations are unavailable. To continue, please contact Coach Deepak.",
  },
  suspended: {
    title: "Your access is paused",
    body: "Coach Deepak has paused your access. Please contact him to resume it.",
  },
  revoked: {
    title: "Your access has been revoked",
    body: "Your access has been withdrawn. Please contact Coach Deepak if you think this is a mistake.",
  },
};

function AccessEnded() {
  const { data: view } = useMyAccess();
  const queryClient = useQueryClient();
  const why: AccessReason =
    view?.kind === "record" && view.status !== "active" ? view.status : "none";
  const message = copy[why];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Brand />
      <div className="panel max-w-md p-8 text-center">
        <h1 className="text-3xl font-medium">{message.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message.body}</p>
        <button type="button" className="btn-outline mt-6" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
