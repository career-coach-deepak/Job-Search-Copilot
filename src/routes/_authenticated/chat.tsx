import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { demoConversations } from "@/lib/demo-data";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Copilot — Job Search Copilot" },
      { name: "description", content: "Chat with your job-search Copilot." },
      { property: "og:title", content: "Copilot — Job Search Copilot" },
      { property: "og:description", content: "Chat with your job-search Copilot." },
    ],
  }),
  component: Chat,
});

type Msg = { role: "user" | "assistant"; text: string };
const seed: Msg[] = [
  { role: "user", text: "Can you help me tailor my resume for a Product Lead role at a fintech?" },
  { role: "assistant", text: "Sample reply. Once connected, the Copilot will analyse the job description and suggest resume edits. (Placeholder — Coach Deepak's instructions not yet added.)" },
];

function Chat() {
  const [active, setActive] = useState("c1");
  const [msgs, setMsgs] = useState<Msg[]>(seed);
  const [text, setText] = useState("");
  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { role: "user", text: t }, { role: "assistant", text: "The Copilot isn't connected yet — this is a preview reply." }]);
    setText("");
  };
  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="space-y-1">
          <button className="btn-primary mb-3 w-full" onClick={() => { setActive(""); setMsgs([]); }}>New conversation</button>
          {demoConversations.map((c) => (
            <button key={c.id} onClick={() => { setActive(c.id); setMsgs(seed); }}
              className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary ${active === c.id ? "bg-secondary font-semibold" : ""}`}>
              {c.title}
            </button>
          ))}
        </aside>
        <section className="panel flex h-[70vh] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {msgs.length === 0 && <p className="pt-20 text-center text-muted-foreground">Start with a job description, your resume, or a question.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-auto max-w-[75%] rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground" : "max-w-[80%] text-sm leading-relaxed"}>
                {m.text}
              </div>
            ))}
          </div>
          <form className="flex gap-2 border-t border-border p-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea autoFocus value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              className="field resize-none" placeholder="Message the Copilot…" />
            <button className="btn-accent self-end">Send</button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
