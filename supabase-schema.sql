create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text,
  role text not null default 'contributor' check (role in ('contributor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles
set role = case when lower(email) = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end
where role is null or role not in ('contributor', 'admin') or lower(email) = 'hcnyastro@gmail.com';
update public.profiles
set role = 'contributor'
where lower(coalesce(email, '')) <> 'hcnyastro@gmail.com'
  and role = 'admin';
alter table public.profiles alter column role set default 'contributor';
alter table public.profiles add constraint profiles_role_check check (role in ('contributor', 'admin'));
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('guide', 'question')),
  title text not null,
  slug text not null unique,
  body text not null,
  tags text[] not null default '{}',
  username text not null default 'Contributor',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  body text not null,
  username text not null default 'Contributor',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_comment_votes (
  comment_id uuid not null references public.forum_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  value int not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create or replace view public.forum_comments_with_scores as
select
  c.id,
  c.thread_id,
  c.body,
  c.username,
  c.created_by,
  c.created_at,
  c.updated_at,
  coalesce(sum(v.value), 0)::int as score
from public.forum_comments c
left join public.forum_comment_votes v on v.comment_id = c.id
group by c.id;

create or replace view public.forum_threads_with_counts as
select
  t.id,
  t.type,
  t.title,
  t.slug,
  t.body,
  t.tags,
  t.username,
  t.created_by,
  t.created_at,
  t.updated_at,
  count(c.id)::int as comment_count
from public.forum_threads t
left join public.forum_comments c on c.thread_id = t.id
group by t.id;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(email) = 'hcnyastro@gmail.com'
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1),
    'Contributor'
  );
begin
  insert into public.profiles (id, email, username, role)
  values (
    new.id,
    lower(new.email),
    display_name,
    case when lower(new.email) = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end
  )
  on conflict (id) do update
  set email = excluded.email,
      username = coalesce(public.profiles.username, excluded.username),
      role = case when excluded.email = 'hcnyastro@gmail.com' then 'admin' else public.profiles.role end,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, username, role)
select
  id,
  lower(email),
  coalesce(split_part(email, '@', 1), 'Contributor'),
  case when lower(email) = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end
from auth.users
on conflict (id) do update
set email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    role = case when excluded.email = 'hcnyastro@gmail.com' then 'admin' else 'contributor' end,
    updated_at = now();

insert into public.forum_threads (
  type, title, slug, body, tags, username, created_at, updated_at
)
values
(
  'guide',
  'Results for AstroChallenge 2025',
  'results-for-astrochallenge-2025',
  $$**Context**

Astrochallenge is an astronomy competition jointly organised by the astronomical societies of NUS and NTU. It aims to enhance students' interest and knowledge in astronomy, and hopes to foster closer inter-school ties through the common interest of astronomy. Students will be exposed to a comprehensive array of questions that range from theoretical to practical astronomy.

**Experience**

In June 2025, a team consisting of 4 HCNY Astro members - Ngiam Hui En, Emma Zhang, Alyssa Tay, and Ng Chyng Yi participated in Astrochallenge. We were awarded Outstanding Project (Silver) and placed third overall.

The competition taught us what an open mind and a spirit of inquiry can do - tackling complex and unfamiliar problems and turning them into meaningful learning opportunities.$$,
  array['competition', 'astrochallenge', 'olympiad'],
  'HCNY Astronomy',
  '2026-06-29T00:00:00+08:00',
  now()
),
(
  'guide',
  'Collaboration with Raffles Institution Science and Astronomy Club',
  'ri-collab-post',
  $$On 27 Feb, HCNY Astro had the pleasure of collaborating with students from Raffles Institution at the latter's campus, bringing around 60 students from the 3 schools.

The main highlights of the collaboration are the astronomy-themed jeopardy game and outdoor stargazing. It was indeed memorable, as the game was met with friendly competition and telescopes were available to focus on celestial objects of the night sky.

Overall, the collaboration was both enjoyable and meaningful, strengthening friendships across schools while fostering a shared interest in astronomy.$$,
  array['collaboration', 'stargazing', 'outreach'],
  'HCNY Astronomy',
  '2026-06-28T00:00:00+08:00',
  now()
)
on conflict (slug) do update
set type = excluded.type,
    title = excluded.title,
    body = excluded.body,
    tags = excluded.tags,
    username = excluded.username,
    updated_at = now();

alter table public.profiles enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_comment_votes enable row level security;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users update their profile" on public.profiles;
create policy "Users update their profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role in ('contributor', 'admin'));

drop policy if exists "Forum threads are public" on public.forum_threads;
create policy "Forum threads are public"
on public.forum_threads
for select
using (true);

drop policy if exists "Contributors create forum threads" on public.forum_threads;
create policy "Contributors create forum threads"
on public.forum_threads
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Contributors edit own threads or admin edits all" on public.forum_threads;
create policy "Contributors edit own threads or admin edits all"
on public.forum_threads
for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "Contributors delete own threads or admin deletes all" on public.forum_threads;
create policy "Contributors delete own threads or admin deletes all"
on public.forum_threads
for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Forum comments are public" on public.forum_comments;
create policy "Forum comments are public"
on public.forum_comments
for select
using (true);

drop policy if exists "Contributors create comments" on public.forum_comments;
create policy "Contributors create comments"
on public.forum_comments
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Contributors edit own comments or admin edits all" on public.forum_comments;
create policy "Contributors edit own comments or admin edits all"
on public.forum_comments
for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "Contributors delete own comments or admin deletes all" on public.forum_comments;
create policy "Contributors delete own comments or admin deletes all"
on public.forum_comments
for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());

drop policy if exists "Forum votes are public" on public.forum_comment_votes;
create policy "Forum votes are public"
on public.forum_comment_votes
for select
using (true);

drop policy if exists "Contributors vote on comments" on public.forum_comment_votes;
create policy "Contributors vote on comments"
on public.forum_comment_votes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Contributors change their votes" on public.forum_comment_votes;
create policy "Contributors change their votes"
on public.forum_comment_votes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Contributors remove their votes" on public.forum_comment_votes;
create policy "Contributors remove their votes"
on public.forum_comment_votes
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select on public.forum_threads_with_counts to anon, authenticated;
grant select on public.forum_comments_with_scores to anon, authenticated;
