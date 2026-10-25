# Job Search Copilot by Coach Deepak — Foundation Plan

## 1. Architecture

```text
Browser (React, TanStack Start)
  - Magic-link sign-in, dashboard, chat, admin pages
  - Holds only the public (anon) key and the user's session
        |
        | bearer token on every call
        v
Server functions (TanStack Start, run on the server)
  - Verify user from token (getUser)
  - Check access record (status + UTC dates) on EVERY chat / conversation call
  - Admin actions check admin table server-side
  - Call OpenAI with server-side secret OPENAI_API_KEY
        |
        v
Your Supabase project (Auth + Postgres with RLS)
```

Notes:
- Lovable's stack uses TanStack Start server functions instead of Supabase Edge Functions. They run server-side only and keep secrets off the browser, satisfying the same requirement.
- Your own Supabase project must be linked by you: Project Settings -> General -> External Supabase -> Connect. It cannot be linked from chat.
- GitHub: connect via the GitHub button in the editor so you own the repo.

## 2. Database schema and authorization

Tables (all in `public`, RLS enabled, explicit grants, no anon access):

- `admins(user_id pk -> auth.users)` — set by you only, via SQL. No insert/update/delete policy for any app role. Checked through a `security definer` function `is_admin(uid)`.
- `client_access(id, user_id null -> auth.users, email unique, full_name, program_name, starts_at timestamptz, ends_at timestamptz, status enum('active','suspended','revoked'), created_at, updated_at)`
  - "upcoming" and "expired" are derived from dates, not stored.
  - Clients: SELECT own row only. No write policies for clients.
  - Writes only via admin server functions.
- `conversations(id, user_id, title, created_at, updated_at)`
- `messages(id, conversation_id, user_id, role enum('user','assistant'), content text, created_at)`
  - RLS: owner-only SELECT, and every policy also requires `has_active_access(auth.uid())`.
  - Writes happen through server functions acting as the user (RLS still applies).
- `ai_usage(user_id, created_at)` — for rate limiting.

Key function: `has_active_access(uid)` = row exists with status='active' AND starts_at <= now() AND now() < ends_at (UTC). Used in RLS and server checks, so an expired client is blocked even with a valid session.

Linking: on first sign-in, a server function links the access row to the user by the verified email from the auth token (never from the request body).

## 3. Server functions

- `getMyAccess` — returns computed status for the signed-in user.
- `listConversations`, `getConversation(id)`, `createConversation`, `deleteConversation` — each re-checks access.
- `sendMessage(conversationId, text)` — validates input (max ~4,000 chars), checks access, rate limit (e.g. 20/hour, 100/day), loads history, calls OpenAI, saves both messages.
- Admin: `adminListClients`, `adminInviteClient`, `adminExtend`, `adminSuspend`, `adminReactivate`, `adminRevoke` — each verifies `is_admin` first.

## 4. Authentication and invitation flow

1. Sign-up is disabled in Supabase Auth settings ("Allow new users to sign up" off) — you change this in your Supabase dashboard.
2. Admin invites a client: server creates the `client_access` row and sends a Supabase invite / magic link (admin API, server-only).
3. Client clicks link -> signed in -> access linked by verified email -> dashboard.
4. No access row, or not active/in date range -> "Your access has ended / is not active" page; chat and history are blocked server-side and by RLS.
5. You become admin by running one SQL insert into `admins` with your user id.

## 5. Security testing checklist

- Unknown email cannot sign in (sign-ups disabled).
- Signed-in user without access row gets denied on every server function.
- Expired / upcoming / suspended / revoked clients denied for chat, history read, and write.
- Client A cannot read Client B's conversations (direct DB query with A's token).
- Client cannot update their own `client_access` or insert into `admins`.
- Non-admin calling admin functions gets 403.
- Service-role key and OpenAI key absent from browser bundle.
- Oversized input and rate-limit overflow rejected.

Automated tests will cover the access-date rule and status computation; RLS checks run as SQL scripts against the database.

## Stages (each needs your go-ahead)

1. Design system, welcome/sign-in page, dashboard and chat UI shell with dummy data (no backend).
2. After you connect Supabase: migration (you approve SQL first), magic-link sign-in.
3. Access enforcement + conversations.
4. OpenAI Copilot with placeholder instructions, rate limits.
5. Admin dashboard.
6. Security tests run and results reported.

## Open items from you

- Connect your Supabase project (Settings -> External Supabase).
- OpenAI API key (added as a secret in stage 4). Alternative: Lovable's built-in AI, which needs no key — say if you prefer it.
- Your final Copilot instructions and reference files (placeholder used until then).
