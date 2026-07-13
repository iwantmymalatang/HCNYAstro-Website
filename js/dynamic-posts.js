import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const clients = new Map();

function getConfig(element) {
    return {
        url: element?.dataset.supabaseUrl?.trim() || "",
        key: element?.dataset.supabaseKey?.trim() || "",
        bucket: element?.dataset.storageBucket?.trim() || "post-images",
    };
}

function getClient(config) {
    if (!config.url || !config.key) return null;
    const id = `${config.url}|${config.key}`;
    if (!clients.has(id)) clients.set(id, createClient(config.url, config.key));
    return clients.get(id);
}

function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72) || "new-post";
}

function safeImageName(name, fallbackTitle) {
    const pieces = name.split(".");
    const extension = pieces.length > 1 ? pieces.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg";
    return `${slugify(pieces.join(".") || fallbackTitle || "post-image")}.${extension || "jpg"}`;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function inlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderBody(markdown) {
    return String(markdown || "")
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            if (block.startsWith("### ")) return `<h3>${inlineMarkdown(block.slice(4))}</h3>`;
            if (block.startsWith("## ")) return `<h2>${inlineMarkdown(block.slice(3))}</h2>`;
            if (block.startsWith("# ")) return `<h2>${inlineMarkdown(block.slice(2))}</h2>`;
            return `<p>${inlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
        })
        .join("");
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-SG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Singapore",
    }).format(date).replace(/\//g, ".");
}

function permissionHelp(action) {
    return `${action} did not change anything. If this keeps happening, run the latest supabase-schema.sql in Supabase SQL Editor so authenticated users can manage posts.`;
}

function normalizeTags(value) {
    if (Array.isArray(value)) {
        return value.map((tag) => String(tag).trim()).filter(Boolean);
    }
    return String(value || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function tagsText(tags) {
    return normalizeTags(tags).join(", ");
}

function renderTags(tags) {
    const normalized = normalizeTags(tags);
    if (!normalized.length) return "";
    return `<div class="tag-row">${normalized.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function sitePostUrl(slug) {
    return new URL(`?post=${encodeURIComponent(slug)}`, `${window.location.origin}${window.location.pathname.replace(/\/post-admin\/?$/, "/posts/")}`).href;
}

function dynamicCard(post) {
    const card = document.createElement("article");
    card.className = "post-card dynamic-post-card";
    card.dataset.dynamicSlug = post.slug;
    card.dataset.timestamp = new Date(post.created_at).getTime() || 0;
    card.innerHTML = `
        <div>
            <time>${formatDate(post.created_at)}</time>
            <h2><a href="?post=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
            ${renderTags(post.tags)}
            ${post.summary ? `<p>${escapeHtml(post.summary)}</p>` : ""}
        </div>
        <a class="read-link" href="?post=${encodeURIComponent(post.slug)}">Read</a>
    `;
    return card;
}

async function initDynamicPosts() {
    const mount = document.getElementById("dynamic-posts");
    if (!mount) return;

    const client = getClient(getConfig(mount));
    const list = document.getElementById("post-list");
    if (!client) {
        list?.classList.remove("is-loading-dynamic");
        return;
    }

    const selectedSlug = new URLSearchParams(window.location.search).get("post");
    if (selectedSlug) {
        const { data, error } = await client
            .from("posts")
            .select("*")
            .eq("slug", selectedSlug)
            .eq("published", true)
            .single();

        document.querySelector(".page-head")?.setAttribute("hidden", "");
        document.getElementById("post-list")?.setAttribute("hidden", "");

        if (error || !data) {
            mount.className = "shell dynamic-posts";
            mount.innerHTML = '<article class="single dynamic-single"><a class="back-link" href="./">← Back</a><h1>Post not found</h1></article>';
            return;
        }

        document.title = `${data.title} | HCNY Astronomy`;
        mount.className = "shell dynamic-posts";
        mount.innerHTML = `
            <article class="single dynamic-single">
                <header class="single-head">
                    <a class="back-link" href="./">← Back</a>
                    <h1>${escapeHtml(data.title)}</h1>
                    <time>${formatDate(data.created_at)}</time>
                    ${renderTags(data.tags)}
                </header>
                ${data.image_url ? `<img class="post-hero-image" src="${escapeHtml(data.image_url)}" alt="${escapeHtml(data.image_alt || data.title)}">` : ""}
                <div class="single-content">${renderBody(data.body)}</div>
            </article>
        `;
        return;
    }

    const { data, error } = await client
        .from("posts")
        .select("title,slug,summary,tags,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });

    if (error) {
        list?.classList.remove("is-loading-dynamic");
        mount.className = "shell";
        mount.innerHTML = '<p class="builder-status">Posts could not load.</p>';
        return;
    }
    if (!data?.length) {
        list?.classList.remove("is-loading-dynamic");
        return;
    }
    if (!list) return;

    list.querySelectorAll(".dynamic-post-card").forEach((card) => card.remove());
    list.prepend(...data.map(dynamicCard));
    list.classList.remove("is-loading-dynamic");
}

async function initViewerSubscribe() {
    const mount = document.getElementById("viewer-subscribe");
    if (!mount) return;

    const client = getClient(getConfig(mount));
    const form = document.getElementById("viewer-subscribe-form");
    const status = document.getElementById("viewer-subscribe-status");
    const params = new URLSearchParams(window.location.search);
    const unsubscribeToken = params.get("unsubscribe");

    if (!client) {
        status.textContent = "Subscriptions are not connected yet.";
        return;
    }

    if (unsubscribeToken) {
        status.textContent = "Unsubscribing...";
        const { error } = await client.rpc("unsubscribe_viewer", { input_token: unsubscribeToken });
        status.textContent = error ? error.message : "You are unsubscribed.";
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("viewer-email").value.trim().toLowerCase();
        if (!email) return;
        status.textContent = "Subscribing...";
        const { error } = await client.rpc("subscribe_viewer", { input_email: email });
        if (error) {
            status.textContent = error.message;
            return;
        }
        form.reset();
        status.textContent = "Subscribed. New posts will be emailed to you.";
    });
}

async function initDynamicLogin() {
    const mount = document.getElementById("dynamic-login");
    if (!mount) return;

    const config = getConfig(mount);
    const client = getClient(config);
    const loginForm = document.getElementById("dynamic-login-form");
    const loginStatus = document.getElementById("login-status");
    const modeInput = document.getElementById("auth-mode");
    const modeCopy = document.getElementById("auth-mode-copy");
    const submitButton = document.getElementById("login-submit-button");
    const editorUrl = mount.dataset.editorUrl || "../post-admin/";
    const modeDetails = {
        signin: {
            title: "Sign in",
            copy: "Use your viewer or contributor account.",
            submit: "Sign in",
            autocomplete: "current-password",
        },
        signup: {
            title: "Sign up",
            copy: "New accounts start as viewers. The site owner must approve contributor or admin access.",
            submit: "Create viewer account",
            autocomplete: "new-password",
        },
        admin: {
            title: "Admin login",
            copy: "Only owner-approved contributor and admin accounts can manage posts.",
            submit: "Admin login",
            autocomplete: "current-password",
        },
    };

    if (!client) {
        loginStatus.textContent = "Login is not connected yet.";
        return;
    }

    const { data } = await client.auth.getSession();
    if (data.session) {
        window.location.href = editorUrl;
        return;
    }

    function setAuthMode(mode) {
        const detail = modeDetails[mode] || modeDetails.signin;
        modeInput.value = mode;
        modeCopy.innerHTML = `<strong>${detail.title}</strong><p>${detail.copy}</p>`;
        submitButton.textContent = detail.submit;
        document.getElementById("login-password").autocomplete = detail.autocomplete;
        document.querySelectorAll("[data-auth-mode]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.authMode === mode);
        });
        loginStatus.textContent = "";
    }

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
    });

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const mode = modeInput.value || "signin";
        loginStatus.textContent = mode === "signup" ? "Creating account..." : "Logging in...";
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const result = mode === "signup"
            ? await client.auth.signUp({ email, password })
            : await client.auth.signInWithPassword({ email, password });
        const { error } = result;
        if (error) {
            loginStatus.textContent = error.message;
            return;
        }

        if (mode === "signup" && !result.data.session) {
            loginStatus.textContent = "Account created. Check your email if Supabase asks you to confirm it.";
            return;
        }

        if (mode === "signup") {
            loginStatus.textContent = "Viewer account created. Ask the owner if you need contributor access.";
            return;
        }
        window.location.href = editorUrl;
    });

    setAuthMode("signin");
}

async function initDynamicEditor() {
    const mount = document.getElementById("dynamic-editor");
    if (!mount) return;

    const config = getConfig(mount);
    const client = getClient(config);
    const postForm = document.getElementById("dynamic-post-form");
    const postStatus = document.getElementById("dynamic-post-status");
    const editorStatus = document.getElementById("editor-status");
    const imageInput = document.getElementById("dynamic-image");
    const imagePreview = document.getElementById("dynamic-image-preview");
    const imagePreviewWrap = document.getElementById("dynamic-image-preview-wrap");
    const manager = document.getElementById("admin-post-manager");
    const postList = document.getElementById("admin-post-list");
    const refreshButton = document.getElementById("refresh-posts-button");
    const clearButton = document.getElementById("clear-editor-button");
    const saveButton = document.getElementById("save-post-button");
    const modeLabel = document.getElementById("editor-mode-label");
    const loginUrl = mount.dataset.loginUrl || "../admin/";

    if (!client) {
        editorStatus.textContent = "Post editor is not connected yet.";
        return;
    }

    async function requireAuth() {
        const { data } = await client.auth.getSession();
        if (!data.session) {
            window.location.href = loginUrl;
            return false;
        }

        const { data: profile, error } = await client
            .from("profiles")
            .select("role")
            .eq("id", data.session.user.id)
            .single();
        if (error || !["contributor", "admin"].includes(profile?.role)) {
            editorStatus.innerHTML = "This login is a viewer account. Ask the owner to make it a contributor before editing posts.";
            const logout = document.createElement("button");
            logout.type = "button";
            logout.textContent = "Log out";
            logout.className = "inline-admin-button";
            logout.addEventListener("click", async () => {
                await client.auth.signOut();
                window.location.href = loginUrl;
            });
            editorStatus.append(" ", logout);
            return false;
        }

        editorStatus.hidden = true;
        postForm.hidden = false;
        manager.hidden = false;
        await loadAdminPosts();
        return true;
    }

    function resetEditor() {
        postForm.reset();
        document.getElementById("dynamic-edit-id").value = "";
        document.getElementById("dynamic-current-slug").value = "";
        imagePreviewWrap.hidden = true;
        modeLabel.textContent = "Create post";
        saveButton.textContent = "Publish post";
        postStatus.textContent = "";
    }

    function fillEditor(post) {
        document.getElementById("dynamic-edit-id").value = post.id;
        document.getElementById("dynamic-current-slug").value = post.slug;
        document.getElementById("dynamic-title").value = post.title || "";
        document.getElementById("dynamic-author").value = post.author || "HCNY Astronomy";
        document.getElementById("dynamic-summary").value = post.summary || "";
        document.getElementById("dynamic-tags").value = tagsText(post.tags);
        document.getElementById("dynamic-body").value = post.body || "";
        document.getElementById("dynamic-image-alt").value = post.image_alt || "";
        document.getElementById("dynamic-published").value = post.published ? "true" : "false";
        imageInput.value = "";
        if (post.image_url) {
            imagePreview.src = post.image_url;
            imagePreview.alt = post.image_alt || post.title || "Post image";
            imagePreviewWrap.hidden = false;
        } else {
            imagePreviewWrap.hidden = true;
        }
        modeLabel.textContent = "Editing post";
        saveButton.textContent = "Save changes";
        postStatus.textContent = "Editing existing post.";
        postForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function loadAdminPosts() {
        postList.innerHTML = '<p class="builder-status">Loading posts...</p>';
        const { data, error } = await client
            .from("posts")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            postList.innerHTML = `<p class="builder-status">${escapeHtml(error.message)}</p>`;
            return;
        }

        if (!data?.length) {
            postList.innerHTML = '<p class="builder-status">No dynamic posts yet.</p>';
            return;
        }

        postList.innerHTML = "";
        data.forEach((post) => {
            const item = document.createElement("article");
            item.className = "admin-post-item";
            item.innerHTML = `
                <div>
                    <time>${formatDate(post.created_at)}</time>
                    <strong>${escapeHtml(post.title)}</strong>
                    ${renderTags(post.tags)}
                    <span>${post.published ? "Published" : "Draft"}</span>
                </div>
                <div class="admin-post-actions">
                    <button type="button" data-action="edit">Edit</button>
                    <button type="button" data-action="delete">Delete</button>
                </div>
            `;
            item.querySelector('[data-action="edit"]').addEventListener("click", () => fillEditor(post));
            item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
                const confirmed = window.confirm(`Delete "${post.title}"?`);
                if (!confirmed) return;
                postStatus.textContent = "Deleting...";
                const result = await client
                    .from("posts")
                    .delete()
                    .eq("id", post.id)
                    .select("id");
                if (result.error) {
                    postStatus.textContent = result.error.message;
                    return;
                }
                if (!result.data?.length) {
                    postStatus.textContent = permissionHelp("Delete");
                    return;
                }
                if (document.getElementById("dynamic-edit-id").value === post.id) resetEditor();
                await loadAdminPosts();
                postStatus.textContent = "Post deleted.";
            });
            postList.append(item);
        });
    }

    imageInput.addEventListener("change", () => {
        const file = imageInput.files?.[0];
        if (!file) {
            imagePreviewWrap.hidden = true;
            return;
        }
        imagePreview.src = URL.createObjectURL(file);
        imagePreview.alt = document.getElementById("dynamic-image-alt").value || "Post image";
        imagePreviewWrap.hidden = false;
    });

    document.getElementById("logout-button").addEventListener("click", async () => {
        await client.auth.signOut();
        window.location.href = loginUrl;
    });
    refreshButton.addEventListener("click", loadAdminPosts);
    clearButton.addEventListener("click", resetEditor);

    postForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        postStatus.textContent = "Publishing...";

        const title = document.getElementById("dynamic-title").value.trim();
        const body = document.getElementById("dynamic-body").value.trim();
        const slug = slugify(title);
        const editId = document.getElementById("dynamic-edit-id").value;
        const file = imageInput.files?.[0];
        let imageUrl = "";

        if (!title || !body) {
            postStatus.textContent = "Title and body are required.";
            return;
        }

        if (file) {
            const imagePath = `${slug}/${Date.now()}-${safeImageName(file.name, title)}`;
            const upload = await client.storage.from(config.bucket).upload(imagePath, file, { upsert: true });
            if (upload.error) {
                postStatus.textContent = upload.error.message;
                return;
            }
            imageUrl = client.storage.from(config.bucket).getPublicUrl(imagePath).data.publicUrl;
        }

        const payload = {
            title,
            slug,
            author: document.getElementById("dynamic-author").value.trim() || "HCNY Astronomy",
            summary: document.getElementById("dynamic-summary").value.trim(),
            tags: normalizeTags(document.getElementById("dynamic-tags").value),
            body,
            image_alt: document.getElementById("dynamic-image-alt").value.trim(),
            published: document.getElementById("dynamic-published").value === "true",
            updated_at: new Date().toISOString(),
        };
        if (imageUrl) payload.image_url = imageUrl;

        const result = editId
            ? await client.from("posts").update(payload).eq("id", editId).select("id")
            : await client.from("posts").insert({ ...payload, image_url: imageUrl }).select("id");
        const { error } = result;
        if (error) {
            postStatus.textContent = error.message;
            return;
        }
        if (!result.data?.length) {
            postStatus.textContent = permissionHelp(editId ? "Save" : "Publish");
            return;
        }

        resetEditor();
        await loadAdminPosts();
        postStatus.innerHTML = `Saved. <a href="../posts/?post=${encodeURIComponent(slug)}">Open post</a>`;

        if (!editId && payload.published) {
            const notification = await client.functions.invoke("notify-new-post", {
                body: {
                    title,
                    summary: payload.summary,
                    tags: payload.tags,
                    slug,
                    url: sitePostUrl(slug),
                    imageUrl: imageUrl || null,
                },
            });
            if (notification.error) {
                postStatus.innerHTML += ` Email/social notification was not sent: ${escapeHtml(notification.error.message)}`;
            }
        }
    });

    await requireAuth();
}

await initDynamicPosts();
await initViewerSubscribe();
await initDynamicLogin();
await initDynamicEditor();
