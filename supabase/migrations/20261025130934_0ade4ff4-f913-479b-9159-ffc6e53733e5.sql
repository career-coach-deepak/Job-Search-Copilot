insert into public.admins (user_id)
select id from auth.users where lower(email) = 'deepak.deopure@gmail.com'
on conflict (user_id) do nothing;