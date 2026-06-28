# HCNY Astronomy Website

Hugo site for HCNYAstro.

## Add or Edit Posts

Posts live in `content/posts/` as Markdown files.

Approved contributors can use the website's "Log in to add a post" link. It opens GitHub's editor; GitHub handles login and only collaborators with access to this repository can commit changes.

To add a post locally:

```powershell
hugo new posts/my-new-post.md
```

Edit the new file, then run:

```powershell
hugo server -D
```

To edit from GitHub, open a file in `content/posts/`, click the pencil icon, commit the change to `main`, and GitHub Pages will redeploy automatically.
