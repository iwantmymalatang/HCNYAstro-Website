-- Run this once in Supabase SQL Editor.
-- Adds uncropped PNG image support for forum posts.

alter table public.forum_threads add column if not exists image_url text;

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
  t.created_at,
  t.updated_at,
  count(c.id)::int as comment_count
from public.forum_threads t
left join public.forum_comments c on c.thread_id = t.id
group by t.id;

grant select on public.forum_threads_with_counts to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/png'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/png'];

drop policy if exists "Forum images are public" on storage.objects;
create policy "Forum images are public"
on storage.objects
for select
using (bucket_id = 'post-images');

drop policy if exists "Contributors upload forum images" on storage.objects;
create policy "Contributors upload forum images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Contributors manage own forum images" on storage.objects;
create policy "Contributors manage own forum images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-images'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
