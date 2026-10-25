import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { accessQueryOptions, isBlocked } from "@/hooks/use-access";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Copilot — Job Search Copilot" },
      { name: "description", content: "Chat with your job-search Copilot." },
      { property: "og:title", content: "Copilot — Job Search Copilot" },
      { property: "og:description", content: "Chat with your job-search Copilot." },
    ],
  }),
  loader: async ({ context }) => {
    const view = await context.queryClient.ensureQueryData(accessQueryOptions);
    if (isBlocked(view)) throw redirect({ to: "/access-ended" });
  },
  component: Chat,
});

function Chat() {
  const { data: view } = useSuspenseQuery(accessQueryOptions);
  const name = view.kind === "record" ? view.fullName.split(/\s+/)[0] || "there" : "there";

  return (
    <AppShell>
      <section className="panel flex h-[70vh] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <p className="pt-20 text-center text-muted-foreground">
            Start with a job description, your resume, or a question, {name}.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            The AI reply arrives in stage 4, together with Coach Deepak's instructions.
          </p>
        </div>
        <form
          className="flex gap-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <textarea
            autoFocus
            maxLength={4000}
            rows={2}
            className="field resize-none"
            placeholder="Message the Copilot…"
          />
          <button className="btn-accent self-end" disabled>Send</button>
        </form>
      </section>
    </AppShell>
  );
}
