-- Admins need to read the client list, not just write to it.

create policy "admins read all client access"
on public.client_access
for select
to authenticated
using (public.is_admin((select auth.uid())));
