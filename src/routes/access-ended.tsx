import { createFileRoute, Link } from "@tanstack/react-router";
import { Brand } from "@/components/AppShell";

export const Route = createFileRoute("/access-ended")({
  head: () => ({
    meta: [
      { title: "Access ended — Job Search Copilot" },
      { name: "description", content: "Your Copilot access is not currently active." },
      { property: "og:title", content: "Access ended — Job Search Copilot" },
      { property: "og:description", content: "Your Copilot access is not currently active." },
    ],
  }),
  component: AccessEnded,
});

function AccessEnded() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Brand />
      <div className="panel max-w-md p-8 text-center">
        <h1 className="text-3xl font-medium">Your access has ended</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your coaching program is no longer active, so the Copilot and your conversations are unavailable.
          To continue, please contact Coach Deepak.
        </p>
        <Link to="/" className="btn-outline mt-6">Sign out</Link>
      </div>
    </div>
  );
}
