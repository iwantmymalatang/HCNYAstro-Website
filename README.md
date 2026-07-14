# HCNY Astronomy Website

Hugo site for HCNYAstro with a Supabase-powered forum.

## Forum Model

- The old posts page is replaced by `/forum/`.
- Every signed-in account is a contributor.
- Contributors can create forum posts, comment, and vote on comments.
- Forum posts are split into `Guides and Documentation` and `Questions`.
- `hcnyastro@gmail.com` is the only admin account and can moderate forum content.

Run `supabase-schema.sql` in the Supabase SQL Editor after deploying these changes. It creates:

- `profiles`
- `forum_threads`
- `forum_comments`
- `forum_comment_votes`
- read views for comment counts and comment scores

Existing AstroChallenge and RI collaboration posts are seeded as guide threads so the old content is not lost.

## Local Development

```powershell
hugo server -D
```
