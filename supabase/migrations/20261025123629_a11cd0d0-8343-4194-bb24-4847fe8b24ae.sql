-- Lock down the access-check functions: no SECURITY DEFINER, no public execute, fixed search_path.

-- 1. Trigger helpers: pin the lookup path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.check_client_access()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(coalesce(new.email, '')));
  if new.email = '' then
    raise exception 'A client email is required.';
  end if;
  if new.ends_at <= new.starts_at then
    raise exception 'Access must end after it starts.';
  end if;
  return new;
end;
$$;

-- 2. Admins: each person may read only their own staff row. This is what the
--    client-management policies check, so the check needs no privileged function.
drop policy "admins can list admins" on public.admins;

create policy "users read own admin row"
on public.admins
for select
to authenticated
using (user_id = (select auth.uid()));

-- 3. Both access checks now run as the caller (security invoker) and are not
--    callable by anonymous visitors.
create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = _user_id
  );
$$;

create or replace function public.has_active_access(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.client_access ca
    where ca.user_id = _user_id
      and ca.status = 'active'
      and ca.starts_at <= now()
      and ca.ends_at > now()
  );
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.has_active_access(uuid) from public, anon;

grant execute on function public.is_admin(uuid) to authenticated, service_role;
grant execute on function public.has_active_access(uuid) to authenticated, service_role;
