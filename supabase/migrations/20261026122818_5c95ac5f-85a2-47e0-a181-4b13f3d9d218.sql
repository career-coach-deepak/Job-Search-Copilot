BEGIN;
REVOKE ALL ON public.admins FROM anon, authenticated;
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
REVOKE ALL ON public.client_access FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_access TO authenticated;
GRANT ALL ON public.client_access TO service_role;
REVOKE ALL ON public.conversations, public.messages, public.ai_usage FROM anon, authenticated;
GRANT ALL ON public.conversations, public.messages, public.ai_usage TO service_role;
CREATE UNIQUE INDEX client_access_one_linked_account ON public.client_access (user_id) WHERE user_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.check_client_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.email := lower(btrim(coalesce(NEW.email, '')));
 IF NEW.email = '' THEN RAISE EXCEPTION 'A client email is required.'; END IF;
 IF NEW.starts_at IS NULL OR NEW.ends_at IS NULL OR NOT isfinite(NEW.starts_at) OR NOT isfinite(NEW.ends_at) OR NEW.ends_at <= NEW.starts_at THEN
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
GRANT UPDATE (display_name, avatar_url, preferences) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "owners update personal profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE FUNCTION public.create_account_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_account_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_account_profile() TO service_role;
CREATE TRIGGER create_profile_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_account_profile();
INSERT INTO public.profiles (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;
COMMIT;