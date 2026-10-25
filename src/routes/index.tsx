import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { capabilities } from "@/lib/demo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Job Search Copilot by Coach Deepak" },
      { name: "description", content: "Private AI workspace for Coach Deepak's coaching clients." },
      { property: "og:title", content: "Job Search Copilot by Coach Deepak" },
      { property: "og:description", content: "Private AI workspace for Coach Deepak's coaching clients." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const [sent, setSent] = useState(false);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-ink-gradient relative hidden flex-col justify-between p-12 text-ink-foreground lg:flex">
        <p className="eyebrow">Private client workspace</p>
        <div>
          <h1 className="text-5xl font-medium leading-tight">Your job search,<br />with a coach in the room.</h1>
          <p className="mt-6 max-w-md text-ink-foreground/75">
            An AI copilot shaped by Coach Deepak's method — available to clients in an active coaching program.
          </p>
          <ul className="mt-10 flex max-w-md flex-wrap gap-2">
            {capabilities.map((c) => (
              <li key={c} className="rounded-full border border-ink-foreground/20 px-3 py-1 text-xs">{c}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-foreground/50">Access by invitation only.</p>
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Job Search Copilot</p>
          <h2 className="mt-2 text-3xl font-medium">Sign in</h2>
          {sent ? (
            <div className="panel mt-8 p-5 text-sm">
              <p className="font-semibold">Check your email.</p>
              <p className="mt-1 text-muted-foreground">If your email is on Coach Deepak's client list, a sign-in link is on its way.</p>
              <Link to="/dashboard" className="btn-primary mt-4 w-full">Continue to preview</Link>
            </div>
          ) : (
            <form className="mt-8 space-y-3" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <label className="text-sm font-medium" htmlFor="email">Email address</label>
              <input id="email" type="email" required className="field" placeholder="you@example.com" />
              <button className="btn-primary w-full">Email me a sign-in link</button>
              <p className="pt-2 text-xs text-muted-foreground">No password needed. New accounts can't be created here — Coach Deepak invites clients directly.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
