create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  body text not null,
  image_url text,
  image_alt text,
  author text default 'HCNY Astronomy',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "Published posts are readable"
on public.posts
for select
using (published = true);

create policy "Authenticated users can create posts"
on public.posts
for insert
to authenticated
with check (true);

create policy "Authenticated users can update posts"
on public.posts
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete posts"
on public.posts
for delete
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = true;

create policy "Post images are public"
on storage.objects
for select
using (bucket_id = 'post-images');

create policy "Authenticated users can upload post images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'post-images');

create policy "Authenticated users can update post images"
on storage.objects
for update
to authenticated
using (bucket_id = 'post-images')
with check (bucket_id = 'post-images');
