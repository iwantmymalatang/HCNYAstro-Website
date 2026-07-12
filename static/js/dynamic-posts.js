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

async function initDynamicPosts() {
    const mount = document.getElementById("dynamic-posts");
    if (!mount) return;

    const client = getClient(getConfig(mount));
    if (!client) return;

    const selectedSlug = new URLSearchParams(window.location.search).get("post");
    if (selectedSlug) {
        const { data, error } = await client
            .from("posts")
            .select("*")
            .eq("slug", selectedSlug)
            .eq("published", true)
            .single();

        document.querySelector(".page-head")?.setAttribute("hidden", "");
        document.querySelector(".post-list")?.setAttribute("hidden", "");

        if (error || !data) {
            mount.innerHTML = '<article class="single dynamic-single"><a class="back-link" href="./">← Back</a><h1>Post not found</h1></article>';
            return;
        }

        document.title = `${data.title} | HCNY Astronomy`;
        mount.innerHTML = `
            <article class="single dynamic-single">
                <header class="single-head">
                    <a class="back-link" href="./">← Back</a>
                    <h1>${escapeHtml(data.title)}</h1>
                    <time>${formatDate(data.created_at)}</time>
                </header>
                ${data.image_url ? `<img class="post-hero-image" src="${escapeHtml(data.image_url)}" alt="${escapeHtml(data.image_alt || data.title)}">` : ""}
                <div class="single-content">${renderBody(data.body)}</div>
            </article>
        `;
        return;
    }

    const { data, error } = await client
        .from("posts")
        .select("title,slug,summary,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });

    if (error) {
        mount.innerHTML = '<p class="builder-status">Dynamic posts could not load.</p>';
        return;
    }
    if (!data?.length) return;

    mount.innerHTML = `
        <div class="dynamic-post-heading"><span>Dynamic posts</span></div>
        <div class="post-list dynamic-list">
            ${data.map((post) => `
                <article class="post-card">
                    <div>
                        <time>${formatDate(post.created_at)}</time>
                        <h2><a href="?post=${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
                        ${post.summary ? `<p>${escapeHtml(post.summary)}</p>` : ""}
                    </div>
                    <a class="read-link" href="?post=${encodeURIComponent(post.slug)}">Read</a>
                </article>
            `).join("")}
        </div>
    `;
}

async function initDynamicAdmin() {
    const mount = document.getElementById("dynamic-admin");
    if (!mount) return;

    const config = getConfig(mount);
    const client = getClient(config);
    const setupNotice = document.getElementById("dynamic-setup-notice");
    const loginForm = document.getElementById("dynamic-login-form");
    const postForm = document.getElementById("dynamic-post-form");
    const loginStatus = document.getElementById("login-status");
    const postStatus = document.getElementById("dynamic-post-status");
    const imageInput = document.getElementById("dynamic-image");
    const imagePreview = document.getElementById("dynamic-image-preview");
    const imagePreviewWrap = document.getElementById("dynamic-image-preview-wrap");

    if (!client) {
        setupNotice.hidden = false;
        loginForm.hidden = true;
        return;
    }

    async function refreshAuth() {
        const { data } = await client.auth.getSession();
        loginForm.hidden = !!data.session;
        postForm.hidden = !data.session;
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

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        loginStatus.textContent = "Logging in...";
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const { error } = await client.auth.signInWithPassword({ email, password });
        loginStatus.textContent = error ? error.message : "";
        if (!error) await refreshAuth();
    });

    document.getElementById("logout-button").addEventListener("click", async () => {
        await client.auth.signOut();
        await refreshAuth();
    });

    postForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        postStatus.textContent = "Publishing...";

        const title = document.getElementById("dynamic-title").value.trim();
        const body = document.getElementById("dynamic-body").value.trim();
        const slug = slugify(title);
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

        const { error } = await client.from("posts").insert({
            title,
            slug,
            author: document.getElementById("dynamic-author").value.trim() || "HCNY Astronomy",
            summary: document.getElementById("dynamic-summary").value.trim(),
            body,
            image_url: imageUrl,
            image_alt: document.getElementById("dynamic-image-alt").value.trim(),
            published: document.getElementById("dynamic-published").value === "true",
        });

        if (error) {
            postStatus.textContent = error.message;
            return;
        }

        postForm.reset();
        imagePreviewWrap.hidden = true;
        postStatus.innerHTML = `Published. <a href="../posts/?post=${encodeURIComponent(slug)}">Open post</a>`;
    });

    await refreshAuth();
}

await initDynamicPosts();
await initDynamicAdmin();
