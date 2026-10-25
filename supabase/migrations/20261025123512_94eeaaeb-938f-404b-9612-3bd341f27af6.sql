-- Job Search Copilot — foundation schema
-- Access rule: status = 'active' AND starts_at <= now() < ends_at (UTC). Derived, never stored.

create type public.access_status as enum ('active', 'suspended', 'revoked');
create type public.message_role as enum ('user', 'assistant');

-- ---------- shared trigger helper ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- admins ----------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'Coaching staff. Rows are inserted only by direct SQL or service-role code — the app never writes here.';

grant select on public.admins to authenticated;
grant all on public.admins to service_role;

alter table public.admins enable row level security;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = _user_id
  );
$$;

comment on function public.is_admin(uuid) is 'True when the user is coaching staff. Security definer so policies can check it without recursing into the admins table.';

create policy "admins can list admins"
on public.admins
for select
to authenticated
using (public.is_admin((select auth.uid())));

-- ---------- client_access ----------
create table public.client_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  program_name text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.access_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.client_access.user_id is 'Null until the invited client signs in for the first time, then linked by their verified email.';

create unique index client_access_email_key on public.client_access (lower(email));
create index client_access_user_idx on public.client_access (user_id);

create or replace function public.check_client_access()
returns trigger
language plpgsql
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

create trigger client_access_check
before insert or update on public.client_access
for each row execute function public.check_client_access();

create trigger client_access_updated_at
before update on public.client_access
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.client_access to authenticated;
grant all on public.client_access to service_role;

alter table public.client_access enable row level security;

create or replace function public.has_active_access(_user_id uuid)
returns boolean
language sql
stable
security definer
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

comment on function public.has_active_access(uuid) is 'The single access rule: active row whose UTC window covers now. Security definer so RLS policies on other tables can call it.';

create policy "clients read own access"
on public.client_access
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "admins insert clients"
on public.client_access
for insert
to authenticated
with check (public.is_admin((select auth.uid())));

create policy "admins update clients"
on public.client_access
for update
to authenticated
using (public.is_admin((select auth.uid())))
with check (public.is_admin((select auth.uid())));

create policy "admins delete clients"
on public.client_access
for delete
to authenticated
using (public.is_admin((select auth.uid())));

-- ---------- conversations ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_idx on public.conversations (user_id, updated_at desc);

create trigger conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;

alter table public.conversations enable row level security;

create policy "owners read own conversations"
on public.conversations
for select
to authenticated
using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

create policy "owners insert own conversations"
on public.conversations
for insert
to authenticated
with check (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

create policy "owners update own conversations"
on public.conversations
for update
to authenticated
using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())))
with check (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

create policy "owners delete own conversations"
on public.conversations
for delete
to authenticated
using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;

alter table public.messages enable row level security;

create policy "owners read own messages"
on public.messages
for select
to authenticated
using (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

create policy "owners insert own messages"
on public.messages
for insert
to authenticated
with check (user_id = (select auth.uid()) and public.has_active_access((select auth.uid())));

-- ---------- ai_usage ----------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

grant select, insert on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

alter table public.ai_usage enable row level security;

create policy "owners read own usage"
on public.ai_usage
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "owners insert own usage"
on public.ai_usage
for insert
to authenticated
with check (user_id = (select auth.uid()));
