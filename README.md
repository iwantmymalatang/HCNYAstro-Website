# HCNY Astronomy Website

Hugo site for HCNYAstro with Supabase-powered posts.

## Roles

- Signed-up accounts automatically receive post email notifications.
- New Supabase Auth accounts start as `member`.
- Contributors can log in at `/admin/`, open the contributor page, and create, edit, publish, draft, delete, and upload images for posts.
- Admins have contributor permissions and can be used as owner accounts.

After running `supabase-schema.sql`, promote an approved account in Supabase SQL Editor:

```sql
update public.profiles
set role = 'contributor'
where email = 'student@example.com';
```

For the HCNY Astro Gmail account:

```sql
update public.profiles
set role = 'contributor'
where email = 'hcnyastro@gmail.com';
```

To make an owner account:

```sql
update public.profiles
set role = 'admin'
where email = 'owner@example.com';
```

## Notifications

The Edge Function at `supabase/functions/notify-new-post/index.ts` runs after a contributor publishes a new post.

Set these Supabase Edge Function secrets to enable email:

```text
RESEND_API_KEY=...
EMAIL_FROM=HCNY Astronomy <updates@example.com>
```

Set these secrets to also publish an Instagram Story image:

```text
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_USER_ID=...
INSTAGRAM_STORY_IMAGE_URL=https://example.com/story-image.png
INSTAGRAM_GRAPH_VERSION=v21.0
```

Instagram publishing requires an Instagram Business or Creator account connected through Meta's official API flow. The email notification contains the post link and unsubscribe link. The story integration posts a story image when credentials are configured.

## Local Development

```powershell
hugo server -D
```

Static Markdown posts can still live in `content/posts/`, but normal posting should happen through the website admin editor.

The two original Markdown posts are also seeded into Supabase by `supabase-schema.sql`. After rerunning the SQL, they appear in the post editor and can be edited or deleted like other posts. The static Markdown versions stay as a fallback, and the website hides duplicate static cards when the Supabase versions load.

New member accounts are automatically added to `public.subscribers`. Existing auth users are backfilled into subscribers the next time `supabase-schema.sql` is run, unless their email is already in the subscriber table.
