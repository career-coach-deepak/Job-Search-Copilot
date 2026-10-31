import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { accessQueryOptions, isBlocked } from "@/hooks/use-access";
import { getMessages, listConversations, sendMessage, type ChatMessage } from "@/lib/chat.functions";

const conversationsQuery = queryOptions({ queryKey: ["conversations"], queryFn: () => listConversations() });
const messagesQuery = (id: string) =>
  queryOptions({ queryKey: ["messages", id], queryFn: () => getMessages({ data: { conversationId: id } }) });

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: z.object({ c: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Copilot — Job Search Copilot" },
      { name: "description", content: "Chat with your job-search Copilot." },
      { property: "og:title", content: "Copilot — Job Search Copilot" },
      { property: "og:description", content: "Chat with your job-search Copilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    const view = await context.queryClient.ensureQueryData(accessQueryOptions);
    if (isBlocked(view)) throw redirect({ to: view.isAdmin ? "/admin" : "/access-ended" });
  },
  component: Chat,
});

function Chat() {
  const { c: activeId } = Route.useSearch();
  const navigate = useNavigate({ from: "/chat" });
  const qc = useQueryClient();
  const { data: view } = useSuspenseQuery(accessQueryOptions);
  const conversationList = useQuery({ ...conversationsQuery, retry: false });
  const conversations = conversationList.data ?? [];
  const messages = useQuery({ ...messagesQuery(activeId ?? ""), enabled: Boolean(activeId) });
  const send = useServerFn(sendMessage);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const name = view.kind === "record" ? view.fullName.split(/\s+/)[0] || "there" : "there";

  const mutation = useMutation({
    mutationFn: (content: string) => send({ data: { conversationId: activeId ?? null, content } }),
    onMutate: (content) => {
      setPending(content);
      setError(null);
    },
    onSuccess: async ({ conversationId }) => {
      setText("");
      await qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      await qc.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId !== activeId) await navigate({ search: { c: conversationId } });
    },
    onError: async (e) => {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      if (activeId) await qc.invalidateQueries({ queryKey: ["messages", activeId] });
    },
    onSettled: () => {
      setPending(null);
      inputRef.current?.focus();
    },
  });

  const list: ChatMessage[] = activeId ? (messages.data ?? []) : [];
  useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [list.length, pending]);
  useEffect(() => inputRef.current?.focus(), [activeId]);

  const submit = () => {
    const v = text.trim();
    if (v && !mutation.isPending) mutation.mutate(v);
  };

  return (
    <AppShell>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="panel flex max-h-[70vh] flex-col p-3">
          <button className="btn-primary w-full" onClick={() => { setError(null); navigate({ search: {} }); }}>
            New conversation
          </button>
          <nav className="mt-3 flex-1 space-y-1 overflow-y-auto">
            {conversationList.isPending && <p className="px-2 py-3 text-xs text-muted-foreground">Loading conversations…</p>}
            {conversationList.isError && (
              <div className="space-y-2 px-2 py-3">
                <p role="alert" className="text-sm text-destructive">Could not load your conversations. Please try again.</p>
                <Button variant="outline" size="sm" onClick={() => void conversationList.refetch()}>Try again</Button>
              </div>
            )}
            {conversationList.isSuccess && conversations.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">No conversations yet.</p>}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => { setError(null); navigate({ search: { c: c.id } }); }}
                className={`block w-full truncate rounded-md px-2 py-2 text-left text-sm ${c.id === activeId ? "bg-muted font-semibold" : "hover:bg-muted/60"}`}
              >
                {c.title}
              </button>
            ))}
          </nav>
        </aside>

        <section className="panel flex h-[70vh] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {list.length === 0 && !pending && !messages.isLoading && (
              <p className="pt-20 text-center text-muted-foreground">
                Start with a job description, your resume, or a question, {name}.
              </p>
            )}
            {messages.isLoading && <p className="text-center text-sm text-muted-foreground">Loading conversation…</p>}
            {messages.isError && <p role="alert" className="text-sm text-destructive">Could not load this conversation. Please try again.</p>}
            {list.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
            {pending && (
              <>
                {list.at(-1)?.content !== pending && <Bubble role="user" content={pending} />}
                <p className="text-sm text-muted-foreground" aria-live="polite">Copilot is thinking…</p>
              </>
            )}
            {error && <p role="alert" className="rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive">{error}</p>}
            <div ref={endRef} />
          </div>
          <form
            className="flex gap-2 border-t border-border p-4"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <textarea
              ref={inputRef}
              autoFocus
              maxLength={4000}
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              className="field resize-none"
              placeholder="Message the Copilot… (Enter to send, Shift+Enter for a new line)"
            />
            <button className="btn-accent self-end" disabled={!text.trim() || mutation.isPending}>
              {mutation.isPending ? "Sending…" : "Send"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return role === "user" ? (
    <div className="ml-auto max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">{content}</div>
  ) : (
    <div className="max-w-[90%] whitespace-pre-wrap text-sm leading-relaxed">
      <p className="eyebrow mb-1">Copilot</p>
      {content}
    </div>
  );
}
