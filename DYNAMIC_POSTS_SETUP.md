# Dynamic Posts Setup

This site can use Supabase for password-protected posting while staying hosted on GitHub Pages.

## 1. Create Supabase Project

Create a project at https://supabase.com.

## 2. Run Database Setup

Open Supabase SQL Editor and run everything in `supabase-schema.sql`.

This creates:
- `public.posts` for dynamic posts
- password-protected insert/update/delete rules
- public read access for published posts
- a public `post-images` storage bucket

## 3. Add Approved Users

In Supabase:

Authentication -> Users -> Add user

Create accounts for approved people using email and password.

## 4. Add Site Keys

In Supabase:

Project Settings -> API

Copy:
- Project URL
- anon public key

Paste them into `hugo.toml`:

```toml
[params]
  supabaseUrl = "https://YOUR-PROJECT.supabase.co"
  supabaseAnonKey = "YOUR-ANON-KEY"
  supabaseStorageBucket = "post-images"
```

The anon key is safe to publish when Row Level Security policies are enabled.

## 5. Publish

Run Hugo, commit, and push.

Approved users can then go to `/admin/`, log in with email/password, and publish posts without editing GitHub files.
