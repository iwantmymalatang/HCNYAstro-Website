-- Make admin labels depend on the HCNYAstro admin account, not usernames.
-- Run this once in Supabase SQL Editor.

alter table public.forum_threads
add column if not exists is_admin_author boolean not null default false;

alter table public.forum_comments
add column if not exists is_admin_author boolean not null default false;

alter table public.forum_reports
add column if not exists is_admin_author boolean not null default false;

create or replace function public.is_hcny_admin_user(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and lower(coalesce(email, '')) = 'hcnyastro@gmail.com'
      and role = 'admin'
  );
$$;

create or replace function public.set_admin_author_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_admin_author := public.is_hcny_admin_user(new.created_by);
  return new;
end;
$$;

drop trigger if exists set_thread_admin_author on public.forum_threads;
create trigger set_thread_admin_author
before insert or update of created_by
on public.forum_threads
for each row execute function public.set_admin_author_flag();

drop trigger if exists set_comment_admin_author on public.forum_comments;
create trigger set_comment_admin_author
before insert or update of created_by
on public.forum_comments
for each row execute function public.set_admin_author_flag();

drop trigger if exists set_report_admin_author on public.forum_reports;
create trigger set_report_admin_author
before insert or update of created_by
on public.forum_reports
for each row execute function public.set_admin_author_flag();

update public.forum_threads
set is_admin_author = public.is_hcny_admin_user(created_by);

update public.forum_comments
set is_admin_author = public.is_hcny_admin_user(created_by);

update public.forum_reports
set is_admin_author = public.is_hcny_admin_user(created_by);

drop view if exists public.forum_comments_with_scores;
create view public.forum_comments_with_scores as
select
  c.id,
  c.thread_id,
  c.parent_id,
  c.body,
  c.username,
  c.created_by,
  c.is_pinned,
  c.is_admin_author,
  c.created_at,
  c.updated_at,
  coalesce(sum(v.value), 0)::int as score
from public.forum_comments c
left join public.forum_comment_votes v on v.comment_id = c.id
group by c.id;

drop view if exists public.forum_threads_with_counts;
create view public.forum_threads_with_counts as
select
  t.id,
  t.type,
  t.title,
  t.slug,
  t.body,
  t.image_url,
  t.tags,
  t.username,
  t.created_by,
  t.status,
  t.audience,
  t.is_pinned,
  t.is_admin_author,
  t.created_at,
  t.updated_at,
  count(c.id)::int as comment_count
from public.forum_threads t
left join public.forum_comments c on c.thread_id = t.id
where t.status = 'approved'
  and (t.audience = 'public' or public.is_trusted())
group by t.id;

grant select on public.forum_threads_with_counts to anon, authenticated;
grant select on public.forum_comments_with_scores to anon, authenticated;
