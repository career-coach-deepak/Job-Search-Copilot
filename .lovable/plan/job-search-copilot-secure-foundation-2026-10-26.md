# Job Search Copilot — secure foundation

## Existing foundation

Supabase is connected. Passwordless sign-in, a signed-in dashboard, client-access tables, and administrator membership already exist. The administrator client list is still sample data. This stage replaces that sample screen with real management and adds the additional profiles you requested.

No AI chat or AI calls will be built. Existing conversation tables remain, but browser writes to these unused features will be disabled for now.

## What will be implemented

- Passwordless email links for existing invited accounts only, with clear sending, success, and failure states.
- A dashboard that requires both a verified signed-in account and an approved, active coaching program. Access begins at `starts_at` and ends strictly before `ends_at`, using UTC.
- Separate profiles containing display name, avatar address, and personal preferences. Profiles never store administrator privileges or access dates.
- A live administrator-only client list with invitation, program/date editing, suspension, reactivation, and revocation. No self-service client approval.
- Recheck authorization on every protected server operation. Disabling a client's access takes effect on the next operation, regardless of a cached screen or still-valid sign-in session.

## Administrator authorization design

- Keep the existing `public.admins` table as the sole source of administrator membership. There is already a coach account; do not create a second role system.
- Every administrator server function validates the signed-in account and checks `is_admin` using that account's database permissions before reading or writing client records.
- Administrator membership cannot be inserted, edited, or deleted through the app. Only a trusted database operator may appoint administrators.
- Ordinary administrator client reads/updates use the caller's client and RLS, not the service-role key.
- Only sending Supabase invitations and linking an unclaimed invitation require elevated credentials. Load them only inside the server handler, after authorization.
- Invitation linking uses the email returned by Supabase `getUser` and requires `email_confirmed_at`; it never accepts an email or user identity from the browser. Check update errors and only link records whose `user_id` is still null.
- Creating an invitation stores access first; if email delivery fails, show the administrator that the record exists but delivery failed, with a retry action. Do not claim an email was sent when it was not.
- Profile changes cannot alter administrator membership or program authorization.

## Proposed migration SQL — review before application

This augments the existing schema; it does not recreate existing client or administrator tables. The migration runs in a transaction and backfills profiles for existing accounts.

```sql
-- Remove unnecessarily broad browser privileges. RLS remains enabled.
REVOKE ALL ON public.admins FROM anon, authenticated;
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;

REVOKE ALL ON public.client_access FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_access TO authenticated;
GRANT ALL ON public.client_access TO service_role;

-- No AI/history writes during the foundation stage.
REVOKE ALL ON public.conversations, public.messages, public.ai_usage
  FROM anon, authenticated;
GRANT ALL ON public.conversations, public.messages, public.ai_usage
  TO service_role;

-- One linked coaching-access record per account (null invitations are allowed).
CREATE UNIQUE INDEX client_access_one_linked_account
  ON public.client_access (user_id) WHERE user_id IS NOT NULL;

-- Strengthen the existing date-validation trigger without changing its name.
CREATE OR REPLACE FUNCTION public.check_client_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.email := lower(btrim(coalesce(NEW.email, '')));
  IF NEW.email = '' THEN
    RAISE EXCEPTION 'A client email is required.';
  END IF;
  IF NEW.starts_at IS NULL OR NEW.ends_at IS NULL
     OR NOT isfinite(NEW.starts_at) OR NOT isfinite(NEW.ends_at)
     OR NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'Access requires finite dates and an end after the start.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, preferences)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "owners update personal profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.create_account_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_account_profile()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_account_profile() TO service_role;
CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_account_profile();

INSERT INTO public.profiles (user_id)
  SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;
```

## Existing RLS policies to preserve

These policies are already installed. No duplicate policies are needed:

```sql
-- admins: SELECT only, authenticated users see their own membership.
USING (user_id = (SELECT auth.uid()))

-- client_access: clients can SELECT their own record.
USING (user_id = (SELECT auth.uid()))

-- client_access: admins can SELECT / DELETE all client records.
USING (public.is_admin((SELECT auth.uid())))

-- client_access: admins can INSERT.
WITH CHECK (public.is_admin((SELECT auth.uid())))

-- client_access: admins can UPDATE.
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())))
```

The installed `is_admin` is `SECURITY INVOKER`, reads the protected `admins` table, and has a pinned search path. There are no client INSERT/UPDATE/DELETE access policies. Neither anonymous users nor clients can appoint themselves administrator. Clients may read their own access-status details even when inactive so the access-ended screen can explain the denial; they cannot retrieve the protected dashboard or other clients' details.

## Technical implementation

- Keep the client-only protected-route layout and bearer attachment already in place.
- Add a reusable server authorization helper that verifies the account with Supabase `getUser`, checks access/admin rights, and reuses `computeAccessStatus`. Fail closed on lookup failures, missing records, and invalid dates.
- Keep status inspection separate from the authorized dashboard function. The dashboard function rejects inactive clients server-side; administrator-only accounts continue to the administrator area.
- Add authenticated administrator server functions and replace sample rows with live, paginated results. Validate emails, IDs, statuses, and UTC date windows on the server.
- Keep editable profile information out of authorization decisions. A separate profile editor is not required for this foundation stage.
- Remove active-looking chat entry points during this stage; the existing chat URL will show an unavailable state without sending or saving messages.
- Refresh access data at route entry and after administrator changes rather than treating cached approval as current authorization.

## How to verify

1. Review the SQL above before approving. After migration, inspect tables, explicit grants, RLS policies, indexes, and triggers; run the Supabase security linter.
2. In Supabase Authentication, verify email sign-in is enabled, public signup is disabled, and only the exact preview/published origins are allowed redirect destinations. App code already prevents creating accounts during sign-in; hosted settings must be checked separately.
3. Open a signed-out dashboard URL: it must return to sign-in, with no client details rendered.
4. Sign in as the coach: only administrators can list, invite, or edit clients. Calling administrator operations as a regular client must fail even if the URL or request is manipulated.
5. Use two separate invited client accounts: each can read only their own access/profile; attempts to read another client's information or change dates/status must fail through the Data API.
6. Test active, upcoming, expired, suspended, revoked, and no-access accounts. Active is allowed at the exact start; denied at the exact end. Suspension/revocation must deny the next protected call while the session is still signed in.
7. Test profile creation for an invited account and verify profile edits cannot change user ID, roles, dates, or administrator membership.
8. Run small automated tests for date boundaries, invalid dates, administrator denial, access denial, validated invitation linking, and server input validation. Where feasible, test database authorization with rollback-only SQL fixtures.
9. Check the browser's downloaded code contains no privileged credentials. AI requests and browser conversation writes must remain unavailable.

**Verification limitation:** This is an externally managed Supabase project. Lovable cannot restore your signed-in session for authenticated browser testing. Public browser checks and server/database tests will be reported separately; authenticated UI flows remain unverified unless an app sign-in session is available. No credentials need to be pasted into chat.

## Approval

Approve this plan to apply the proposed migration and implement this foundation only. No database changes have been applied during this review.