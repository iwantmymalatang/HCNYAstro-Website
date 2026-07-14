-- Run this once in Supabase SQL Editor for the private admin dashboard.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(lower(auth.jwt() ->> 'email') = 'hcnyastro@gmail.com', false)
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and lower(email) = 'hcnyastro@gmail.com'
        and role = 'admin'
    );
$$;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

grant select on public.forum_threads_with_counts to anon, authenticated;
grant select on public.forum_comments_with_scores to anon, authenticated;
