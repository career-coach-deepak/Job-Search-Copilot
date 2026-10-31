import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { hasAccess } from "@/lib/access";

/*
 * Chat tables are deliberately not reachable from the browser (no grants for
 * signed-in users). These server functions are the only door: each one checks
 * the verified caller's active access, then reads/writes with an explicit
 * user_id filter so a person only ever touches their own conversations.
 */

const HOURLY_LIMIT = 30;
const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT = `You are the Job Search Copilot by Coach Deepak, a warm, practical career coach assistant.
Help clients with resumes, job-description analysis, LinkedIn profiles, networking, outreach messages and job-search plans.
Be specific and actionable, ask a clarifying question when the request is vague, and never invent facts about the client's experience.`;

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function requireActive({ supabase, userId }: Ctx) {
  const { data, error } = await supabase
    .from("client_access")
    .select("status, starts_at, ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Copilot access lookup failed", error.code);
    throw new Error("Could not check your Copilot access. Please try again.");
  }
  if (!data || !hasAccess({ status: data.status, startsAt: data.starts_at, endsAt: data.ends_at })) {
    throw new Error("Your Copilot access is not active.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type ConversationItem = { id: string; title: string; updatedAt: string };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationItem[]> => {
    const db = await requireActive(context);
    const { data, error } = await db
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("Copilot conversation lookup failed", error.code);
      throw new Error("Could not load your conversations. Please try again.");
    }
    return (data ?? []).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ChatMessage[]> => {
    const db = await requireActive(context);
    const { data: rows, error } = await db
      .from("messages")
      .select("id, role, content")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error("Could not load this conversation.");
    return rows;
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        conversationId: z.string().uuid().nullable(),
        content: z.string().trim().min(1, "Message is empty.").max(4000, "Message is too long (4,000 characters max)."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await requireActive(context);
    const { userId } = context;

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error("The AI isn't set up yet: the OpenAI key has not been added to the project's secrets.");
    }

    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) >= HOURLY_LIMIT) {
      throw new Error(`You've reached ${HOURLY_LIMIT} messages this hour. Please try again a little later.`);
    }

    // Find or create the conversation, always scoped to the caller.
    let conversationId = data.conversationId;
    if (conversationId) {
      const { data: own } = await db
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!own) throw new Error("Conversation not found.");
    } else {
      const { data: created, error } = await db
        .from("conversations")
        .insert({ user_id: userId, title: data.content.slice(0, 60) })
        .select("id")
        .single();
      if (error || !created) throw new Error("Could not start a conversation.");
      conversationId = created.id;
    }

    const { error: userErr } = await db
      .from("messages")
      .insert({ conversation_id: conversationId, user_id: userId, role: "user", content: data.content });
    if (userErr) throw new Error("Could not save your message.");

    const { data: history } = await db
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    await db.from("ai_usage").insert({ user_id: userId });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...(history ?? []).reverse()],
      }),
    });
    if (!res.ok) {
      console.error("OpenAI error", res.status, (await res.text()).slice(0, 500));
      const msg =
        res.status === 401
          ? "The OpenAI key was rejected. Please check the key saved in the project's secrets."
          : res.status === 429
            ? "OpenAI is busy or the account has no credit left. Please try again shortly."
            : "The AI couldn't answer right now. Your message was saved — please try again.";
      throw new Error(msg);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("The AI returned an empty reply. Please try again.");

    const { error: aiErr } = await db
      .from("messages")
      .insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: reply });
    if (aiErr) throw new Error("The reply could not be saved.");
    await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);

    return { conversationId };
  });
