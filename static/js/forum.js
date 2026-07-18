import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = document.getElementById("forum-app");
const config = {
    url: app?.dataset.supabaseUrl?.trim() || "",
    key: app?.dataset.supabaseKey?.trim() || "",
    bucket: app?.dataset.storageBucket?.trim() || "post-images",
};
const client = config.url && config.key ? createClient(config.url, config.key) : null;

const state = {
    tab: "guide",
    session: null,
    profile: null,
    threads: [],
    selectedThread: null,
};

const els = {
    account: document.getElementById("forum-account"),
    compose: document.getElementById("forum-compose"),
    composeStatus: document.getElementById("forum-compose-status"),
    status: document.getElementById("forum-status"),
    userPanel: document.getElementById("forum-user-panel"),
    list: document.getElementById("forum-list"),
    thread: document.getElementById("forum-thread"),
    newPost: document.getElementById("forum-new-post"),
    settingsPanel: document.getElementById("forum-settings-panel"),
    settingsIntro: document.getElementById("forum-settings-intro"),
    settingsUsername: document.getElementById("forum-settings-username"),
    settingsNotifications: document.getElementById("forum-settings-notifications"),
    settingsStatus: document.getElementById("forum-settings-status"),
    settingsClose: document.getElementById("forum-settings-close"),
    welcomePopup: document.getElementById("forum-welcome-popup"),
    welcomeContinue: document.getElementById("forum-welcome-continue"),
    editId: document.getElementById("forum-edit-id"),
    type: document.getElementById("forum-type"),
    audienceRow: document.getElementById("forum-audience-row"),
    audience: document.getElementById("forum-audience"),
    postingAs: document.getElementById("forum-posting-as"),
    title: document.getElementById("forum-title"),
    tags: document.getElementById("forum-tags"),
    body: document.getElementById("forum-body"),
    inlineImageButton: document.getElementById("forum-inline-image-button"),
    inlineImages: document.getElementById("forum-inline-images"),
    image: document.getElementById("forum-image"),
    imageUrl: document.getElementById("forum-image-url"),
    imagePreview: document.getElementById("forum-image-preview"),
    submit: document.getElementById("forum-submit"),
    cancelEdit: document.getElementById("forum-cancel-edit"),
};

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function slugify(value) {
    return value.toLowerCase().trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 72) || "forum-post";
}

function normalizeTags(value) {
    if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
    return String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function renderTags(tags) {
    const normalized = normalizeTags(tags);
    if (!normalized.length) return "";
    return `<div class="tag-row">${normalized.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function inlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<img class="inline-post-image" src="$2" alt="$1" loading="lazy">')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function imageFigure(markdownImage) {
    const match = markdownImage.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)$/);
    if (!match) return "";
    const [, alt, url] = match;
    return `
        <figure class="forum-post-image">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(alt || "Forum post image")}" loading="lazy">
            ${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ""}
        </figure>
    `;
}

function isMarkdownTable(block) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.length >= 2
        && lines[0].includes("|")
        && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1]);
}

function splitTableRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells = [];
    let current = "";
    let escaping = false;
    for (const char of trimmed) {
        if (escaping) {
            current += char;
            escaping = false;
        } else if (char === "\\") {
            escaping = true;
        } else if (char === "|") {
            cells.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    cells.push(current.trim());
    return cells;
}

function renderMarkdownTable(block) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const headers = splitTableRow(lines[0]);
    const rows = lines.slice(2).map(splitTableRow);
    return `
        <div class="forum-table-wrap">
            <table class="forum-table">
                <thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>
                <tbody>
                    ${rows.map((row) => `<tr>${headers.map((_, index) => `<td>${inlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderBody(markdown) {
    return String(markdown || "")
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            if (block.startsWith("### ")) return `<h3>${inlineMarkdown(block.slice(4))}</h3>`;
            if (block.startsWith("## ")) return `<h2>${inlineMarkdown(block.slice(3))}</h2>`;
            if (/^!\[[^\]]*\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)$/.test(block)) return imageFigure(block);
            if (isMarkdownTable(block)) return renderMarkdownTable(block);
            return `<p>${inlineMarkdown(block).replace(/\n/g, "<br>")}</p>`;
        })
        .join("");
}

function plainPreview(markdown, maxLength = 130) {
    const text = String(markdown || "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        .replace(/\[([^\]]+)\]\[[^\]]+\]/g, "$1")
        .replace(/\[([^\[\]]+)\[[^\]]+\]/g, "$1")
        .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
        .replace(/[*_~>#-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function renderPostImage(url, title = "") {
    if (!url) return "";
    return `
        <figure class="forum-post-image">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(title ? `${title} image` : "Forum post image")}" loading="lazy">
        </figure>
    `;
}

function statusLabel(status) {
    if (status === "approved") return "Validated";
    if (status === "rejected") return "Needs changes";
    return "Waiting for validation";
}

function statusReminder(status) {
    if (status === "rejected") {
        return "Please make the requested changes, then save the post again to send it back for validation.";
    }
    if (status === "pending") {
        return "Your post is saved and waiting for admin validation.";
    }
    return "";
}

function validationNote(post) {
    return post.status === "rejected" && post.validation_note
        ? `Admin note: ${post.validation_note}`
        : "";
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

function isHcnyAdmin() {
    const email = (state.session?.user?.email || state.profile?.email || "").toLowerCase();
    return email === "hcnyastro@gmail.com";
}

function isAdmin() {
    return isHcnyAdmin() || state.profile?.role === "admin";
}

function isTrusted() {
    return isAdmin() || state.profile?.trust_status === "trusted";
}

function contributorLabel() {
    if (isAdmin()) return "Admin";
    return isTrusted() ? "Validated contributor" : "New contributor";
}

function isEmailConfirmed() {
    return Boolean(state.session);
}

function canEdit(row) {
    return isAdmin() || row.created_by === state.session?.user?.id;
}

function canDeleteComment(comment) {
    return isAdmin() || comment.created_by === state.session?.user?.id;
}

function canDeleteThread(thread) {
    return isAdmin() || thread.created_by === state.session?.user?.id;
}

function displayName() {
    return state.profile?.username || state.session?.user?.email?.split("@")[0] || "Contributor";
}

function renderUsername(name, isAdminAuthor = false) {
    const safeName = escapeHtml(name || "Contributor");
    return isAdminAuthor ? `<span class="admin-glow-name">${safeName}</span>` : safeName;
}

function resetCompose() {
    els.compose.reset();
    els.editId.value = "";
    els.imageUrl.value = "";
    updateImagePreview("");
    els.type.value = state.tab;
    els.audience.value = "public";
    els.audienceRow.hidden = !isAdmin();
    els.submit.textContent = "Share with the forum";
    els.cancelEdit.textContent = "Close";
    els.composeStatus.textContent = "";
    els.postingAs.textContent = state.session ? `Posting as ${displayName()}` : "";
    els.compose.hidden = true;
    els.compose.classList.remove("is-open");
}

function setStatus(message) {
    if (message === "Loading forum...") {
        els.status.innerHTML = `
            <span class="three-body-loading">
                <span class="three-body-loader" aria-hidden="true"><span></span><span></span><span></span></span>
                <span>Loading forum...</span>
            </span>
        `;
    } else {
        els.status.textContent = message || "";
    }
    els.status.hidden = !message;
}

async function refreshProfile() {
    if (!state.session) {
        state.profile = null;
        return;
    }

    const { data, error } = await client
        .from("profiles")
        .select("id,email,username,role,trust_status,settings_completed,notifications_enabled")
        .eq("id", state.session.user.id)
        .single();
    if (error) {
        const repaired = await client.rpc("ensure_profile");
        if (repaired.error) {
            state.profile = {
                id: state.session.user.id,
                email: state.session.user.email,
                username: state.session.user.email?.split("@")[0] || "Contributor",
                role: "contributor",
                trust_status: "untrusted",
                settings_completed: false,
                notifications_enabled: true,
            };
            return;
        }
        state.profile = repaired.data;
        return;
    }
    state.profile = data;
    if (isHcnyAdmin()) {
        state.profile = {
            ...state.profile,
            role: "admin",
            trust_status: "trusted",
            settings_completed: true,
            email: state.session.user.email || state.profile.email,
        };
    }
}

async function renderAccount() {
    if (!client) {
        els.account.innerHTML = '<span class="builder-status">Forum is not connected.</span>';
        return;
    }

    if (!state.session) {
        els.account.innerHTML = `
            <button type="button" id="forum-new-post">New post</button>
            <a class="read-link" href="../admin/">Sign in</a>
        `;
        document.getElementById("forum-new-post").addEventListener("click", () => {
            window.location.href = "../admin/";
        });
        els.compose.hidden = true;
        return;
    }

    if (!isEmailConfirmed()) {
        els.account.innerHTML = `
            <span>Confirm your email before posting.</span>
            <button type="button" id="forum-logout">Log out</button>
        `;
        document.getElementById("forum-logout").addEventListener("click", async () => {
            await client.auth.signOut();
            state.session = null;
            state.profile = null;
            await renderAccount();
            await loadThreads();
        });
        els.compose.hidden = true;
        return;
    }

    els.account.innerHTML = `
        <button type="button" id="forum-new-post">New post</button>
        <span>${renderUsername(displayName(), isAdmin())}</span>
        <strong>${contributorLabel()}</strong>
        ${isAdmin() ? '<a class="read-link" href="../admin-dashboard/">Dashboard</a>' : ""}
        ${isAdmin() ? '<button type="button" id="forum-reports">Reports</button>' : ""}
        <button type="button" id="forum-settings">My settings</button>
        <button type="button" id="forum-logout">Log out</button>
    `;
    document.getElementById("forum-new-post").addEventListener("click", openComposer);
    document.getElementById("forum-reports")?.addEventListener("click", openReports);
    document.getElementById("forum-settings").addEventListener("click", openSettings);
    document.getElementById("forum-logout").addEventListener("click", async () => {
        await client.auth.signOut();
        state.session = null;
        state.profile = null;
        await renderAccount();
        await loadThreads();
    });
}

function friendlyError(error) {
    const message = error?.message || String(error || "");
    const lower = message.toLowerCase();
    if (lower.includes("duplicate") || lower.includes("profiles_username_key_unique")) {
        return "That username is already taken. Choose a different one.";
    }
    if (lower.includes("username cannot include admin")) {
        return "Only the HCNY Astro admin account can use admin in a username.";
    }
    if (message.includes("parent_id")) {
        return "Reply threads are not set up in Supabase yet. Run supabase-add-comment-replies.sql in Supabase SQL Editor, then refresh.";
    }
    if (message.includes("forum_admin_messages") || lower.includes("row-level security")) {
        return "Admin messages are not fully set up yet. Run supabase-pinning-audience-messages.sql in Supabase SQL Editor, then refresh.";
    }
    if (message.includes("forum_threads") || message.includes("forum_comments") || message.includes("does not exist")) {
        return "Forum database is not set up yet. Run the latest supabase-schema.sql in Supabase SQL Editor, then refresh this page.";
    }
    return message;
}

async function loadThreads() {
    if (!client) {
        setStatus("Forum is not connected yet.");
        return;
    }
    setStatus("Loading forum...");
    app.classList.remove("is-reading");
    document.querySelector(".forum-head")?.removeAttribute("hidden");
    els.thread.hidden = true;

    const { data, error } = await client
        .from("forum_threads_with_counts")
        .select("*")
        .eq("type", state.tab)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

    if (error) {
        els.list.innerHTML = "";
        setStatus(friendlyError(error));
        return;
    }

    state.threads = data || [];
    setStatus("");
    renderThreadList();
    await renderUserPanel();
    const threadId = new URLSearchParams(window.location.search).get("thread");
    if (threadId && !state.selectedThread) {
        await openThread(threadId);
    }
}

function renderThreadList() {
    els.thread.hidden = true;
    els.settingsPanel.hidden = true;
    if (!state.threads.length) {
        els.list.innerHTML = `<p class="builder-status">No ${state.tab === "guide" ? "guides" : "questions"} yet.</p>`;
        return;
    }
    els.list.innerHTML = state.threads.map((thread) => `
        <article class="post-card forum-card" data-thread-id="${thread.id}" data-pinned="${thread.is_pinned}">
            <div class="forum-card-kicker">
                ${thread.is_pinned ? '<span class="pinned-label">Pinned</span>' : ""}
                <time>${formatDate(thread.created_at)}</time>
                ${renderTags(thread.tags)}
            </div>
            <h2><button type="button" data-open-thread="${thread.id}">${escapeHtml(thread.title)}</button></h2>
            <p>${escapeHtml(plainPreview(thread.body))}</p>
            <div class="forum-card-footer">
                <span class="forum-meta">By ${renderUsername(thread.username || "Contributor", thread.is_admin_author)} · ${thread.audience === "trusted" ? "Validated only · " : ""}${thread.comment_count || 0} comments</span>
                <button class="read-link" type="button" data-open-thread="${thread.id}" aria-label="View ${escapeHtml(thread.title)}">View →</button>
            </div>
        </article>
    `).join("");

    els.list.querySelectorAll("[data-open-thread]").forEach((button) => {
        button.addEventListener("click", () => openThread(button.dataset.openThread));
    });
}

async function renderUserPanel() {
    if (!els.userPanel || !state.session) {
        if (els.userPanel) els.userPanel.hidden = true;
        return;
    }
    let { data: posts, error } = await client
        .from("forum_threads")
        .select("id,title,status,type,validation_note,created_at,updated_at")
        .eq("created_by", state.session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
    if (error && (error.message || "").includes("validation_note")) {
        const fallback = await client
            .from("forum_threads")
            .select("id,title,status,type,created_at,updated_at")
            .eq("created_by", state.session.user.id)
            .order("created_at", { ascending: false })
            .limit(20);
        posts = fallback.data;
        error = fallback.error;
    }
    if (error) {
        els.userPanel.hidden = true;
        return;
    }
    const postRows = (posts || []).map((post) => `
        <article>
            <strong>${escapeHtml(post.title)}</strong>
            <span>${escapeHtml(post.type)} · ${statusLabel(post.status)}</span>
            ${statusReminder(post.status) ? `<p>${escapeHtml(statusReminder(post.status))}</p>` : ""}
            ${validationNote(post) ? `<p>${escapeHtml(validationNote(post))}</p>` : ""}
            <span>Submitted ${formatDate(post.created_at)}${post.updated_at && post.updated_at !== post.created_at ? ` · Last edited ${formatDate(post.updated_at)}` : ""}</span>
            <div class="forum-status-actions">
                <button type="button" data-open-user-post="${post.id}">Open</button>
                <button type="button" data-edit-user-post="${post.id}">Edit</button>
            </div>
        </article>
    `).join("");
    els.userPanel.innerHTML = `
        <div>
            <h2>Your forum space</h2>
            <p>${isTrusted()
                ? "You can share posts and join comments directly. Your ideas help make the resource library stronger."
                : "You are encouraged to make a post. New posts are sent for validation first, then they can appear for everyone once reviewed."}</p>
        </div>
        <div class="forum-status-list">${postRows || '<p class="builder-status">No posts from you yet. Start with a question, a useful link, or a short guide.</p>'}</div>
        <form class="forum-admin-message" id="forum-admin-message">
            <label>
                <span>${isTrusted() ? "Message admin" : "Ask for contributor validation / message admin"}</span>
                <textarea rows="3" name="message" placeholder="Write a short message to HCNY Astro..." required></textarea>
            </label>
            <button type="submit">${isTrusted() ? "Send message" : "Send to admin"}</button>
            <p class="builder-status" data-admin-message-status></p>
        </form>
    `;
    els.userPanel.hidden = false;
    els.userPanel.querySelector("#forum-admin-message").addEventListener("submit", submitAdminMessage);
    els.userPanel.querySelectorAll("[data-open-user-post]").forEach((button) => {
        button.addEventListener("click", () => openThread(button.dataset.openUserPost));
    });
    els.userPanel.querySelectorAll("[data-edit-user-post]").forEach((button) => {
        button.addEventListener("click", () => loadThreadForEdit(button.dataset.editUserPost));
    });
}

async function openThread(id) {
    els.compose.hidden = true;
    els.settingsPanel.hidden = true;
    const { data, error } = await client
        .from("forum_threads")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        setStatus(friendlyError(error));
        return;
    }

    state.selectedThread = data;
    app.classList.add("is-reading");
    document.querySelector(".forum-head")?.setAttribute("hidden", "");
    els.list.innerHTML = "";
    els.thread.hidden = false;
    await renderSelectedThread();
}

async function submitAdminMessage(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-admin-message-status]");
    const submit = form.querySelector('button[type="submit"]');
    const message = form.elements.message.value.trim();
    if (!message) return;
    if (!state.session?.user?.id) {
        status.textContent = "Sign in before messaging admin.";
        return;
    }
    status.textContent = "Sending...";
    if (submit) submit.disabled = true;

    let timedOut = false;
    const fallback = setTimeout(() => {
        timedOut = true;
        form.reset();
        status.textContent = "Sent to admin.";
        if (submit) submit.disabled = false;
    }, 4500);

    const { error } = await client.from("forum_admin_messages").insert({
        user_id: state.session.user.id,
        message,
        kind: isTrusted() ? "message" : "trust_application",
        username: displayName(),
    });
    clearTimeout(fallback);
    if (error) {
        status.textContent = friendlyError(error);
        if (submit) submit.disabled = false;
        return;
    }
    if (!timedOut) {
        form.reset();
        status.textContent = "Sent to admin.";
        if (submit) submit.disabled = false;
    }
}

async function fetchComments(threadId) {
    const { data, error } = await client
        .from("forum_comments_with_scores")
        .select("*")
        .eq("thread_id", threadId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: true });
    if (error) throw new Error(friendlyError(error));
    return data || [];
}

function sortTopComments(comments) {
    return [...comments].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff) return scoreDiff;
        return new Date(a.created_at) - new Date(b.created_at);
    });
}

function groupReplies(comments) {
    return comments.reduce((groups, comment) => {
        const key = comment.parent_id || "root";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(comment);
        return groups;
    }, new Map());
}

function renderCommentTree(comments) {
    const groups = groupReplies(comments);
    const topLevel = sortTopComments(groups.get("root") || []);
    if (!topLevel.length) return '<p class="builder-status">No comments yet.</p>';
    return topLevel.map((comment) => renderComment(comment, groups, 0)).join("");
}

async function renderSelectedThread() {
    const thread = state.selectedThread;
    const comments = await fetchComments(thread.id);
    const actions = [
        canEdit(thread) ? '<button type="button" data-edit-thread>Edit</button>' : "",
        isAdmin() ? `<button type="button" data-pin-thread>${thread.is_pinned ? "Unpin post" : "Pin post"}</button>` : "",
        canDeleteThread(thread) ? '<button type="button" data-delete-thread>Delete</button>' : "",
    ].join("");
    const reportThreadAction = state.session
        ? '<button type="button" data-report-thread>Report</button>'
        : "";
    const commentForm = state.session && isEmailConfirmed() && isTrusted()
        ? `<form class="comment-form" id="comment-form">
                <label>
                    <span>Comment as ${escapeHtml(displayName())}</span>
                    <textarea id="comment-body" rows="4" placeholder="Add a comment..." required></textarea>
                </label>
                <div class="builder-actions"><button type="submit">Comment</button></div>
                <p class="builder-status" id="comment-status"></p>
            </form>`
        : state.session
            ? '<p class="builder-status">Comments open after contributor validation. You can still share posts for review and validation.</p>'
            : '<p class="builder-status"><a href="../admin/">Sign in</a> to comment and vote.</p>';

    els.thread.innerHTML = `
        <button class="back-link" type="button" data-back-forum>← Back</button>
        <header class="single-head">
            <div class="forum-card-kicker">
                ${thread.is_pinned ? '<span class="pinned-label">Pinned</span>' : ""}
                <time>${formatDate(thread.created_at)}</time>
                ${renderTags(thread.tags)}
            </div>
            <h1>${escapeHtml(thread.title)}</h1>
            <p class="forum-meta">By ${renderUsername(thread.username || "Contributor", thread.is_admin_author)}</p>
            <div class="admin-post-actions">${actions}${reportThreadAction}</div>
        </header>
        <div class="single-content">${renderBody(thread.body)}</div>
        ${renderPostImage(thread.image_url, thread.title)}
        <section class="comments">
            <h2>Comments</h2>
            ${commentForm}
            <div class="comment-list">
                ${renderCommentTree(comments)}
            </div>
        </section>
    `;

    els.thread.querySelector("[data-back-forum]").addEventListener("click", loadThreads);
    els.thread.querySelector("[data-edit-thread]")?.addEventListener("click", () => editThread(thread));
    els.thread.querySelector("[data-pin-thread]")?.addEventListener("click", () => toggleThreadPin(thread));
    els.thread.querySelector("[data-delete-thread]")?.addEventListener("click", () => deleteThread(thread.id));
    els.thread.querySelector("[data-report-thread]")?.addEventListener("click", () => reportContent({ threadId: thread.id }));
    els.thread.querySelector("#comment-form")?.addEventListener("submit", submitComment);
    els.thread.querySelectorAll("[data-vote-comment]").forEach((button) => {
        button.addEventListener("click", () => voteComment(button.dataset.voteComment, Number(button.dataset.voteValue)));
    });
    els.thread.querySelectorAll("[data-delete-comment]").forEach((button) => {
        button.addEventListener("click", () => deleteComment(button.dataset.deleteComment));
    });
    els.thread.querySelectorAll("[data-report-comment]").forEach((button) => {
        button.addEventListener("click", () => reportContent({ threadId: thread.id, commentId: button.dataset.reportComment }));
    });
    els.thread.querySelectorAll("[data-reply-comment]").forEach((button) => {
        button.addEventListener("click", () => toggleReplyForm(button.dataset.replyComment));
    });
    els.thread.querySelectorAll("[data-reply-form]").forEach((form) => {
        form.addEventListener("submit", (event) => submitComment(event, form.dataset.replyForm));
    });
    els.thread.querySelectorAll("[data-pin-comment]").forEach((button) => {
        button.addEventListener("click", () => toggleCommentPin(button.dataset.pinComment));
    });
}

function renderComment(comment, groups, depth) {
    const replies = (groups.get(comment.id) || []).sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(a.created_at) - new Date(b.created_at);
    });
    const deleteAction = canDeleteComment(comment)
        ? `<button type="button" data-delete-comment="${comment.id}">Delete</button>`
        : "";
    const pinAction = isAdmin() ? `<button type="button" data-pin-comment="${comment.id}">${comment.is_pinned ? "Unpin" : "Pin"}</button>` : "";
    const actions = state.session && isTrusted()
        ? `<button type="button" data-reply-comment="${comment.id}">Reply</button><button type="button" data-report-comment="${comment.id}">Report</button>${pinAction}${deleteAction}`
        : "";
    const replyForm = state.session && isTrusted()
        ? `<form class="reply-form" data-reply-form="${comment.id}" hidden>
                <textarea name="comment-body" rows="3" placeholder="Reply to ${escapeHtml(comment.username || "Contributor")}..." required></textarea>
                <div class="builder-actions">
                    <button type="submit">Reply</button>
                </div>
                <p class="builder-status" data-reply-status></p>
            </form>`
        : "";
    return `
        <div class="comment-thread" style="--reply-depth: ${Math.min(depth, 5)}">
            <article class="comment">
                <div class="comment-votes">
                    ${isTrusted() ? `<button type="button" data-vote-comment="${comment.id}" data-vote-value="1">▲</button>` : ""}
                    <strong>${comment.score || 0}</strong>
                    ${isTrusted() ? `<button type="button" data-vote-comment="${comment.id}" data-vote-value="-1">▼</button>` : ""}
                </div>
                <div>
                    <div class="forum-meta">${comment.is_pinned ? "Pinned · " : ""}${renderUsername(comment.username || "Contributor", comment.is_admin_author)} · ${formatDate(comment.created_at)}</div>
                    <p>${escapeHtml(comment.body)}</p>
                    <div class="admin-post-actions">${actions}</div>
                    ${replyForm}
                </div>
            </article>
            ${replies.length ? `<div class="comment-replies">${replies.map((reply) => renderComment(reply, groups, depth + 1)).join("")}</div>` : ""}
        </div>
    `;
}

function toggleReplyForm(commentId) {
    const form = els.thread.querySelector(`[data-reply-form="${CSS.escape(commentId)}"]`);
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("textarea")?.focus();
}

async function submitComment(event, parentId = null) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("[data-reply-status]") || document.getElementById("comment-status");
    if (!isEmailConfirmed()) {
        status.textContent = "Confirm your email before commenting.";
        return;
    }
    if (!isTrusted()) {
        status.textContent = "Comments open after contributor validation.";
        return;
    }
    const body = form.querySelector('[name="comment-body"], #comment-body')?.value.trim();
    if (!body) return;
    status.textContent = "Saving comment...";
    const payload = {
        thread_id: state.selectedThread.id,
        body,
        username: displayName(),
    };
    if (parentId) payload.parent_id = parentId;
    const { error } = await client.from("forum_comments").insert(payload);
    if (error) {
        status.textContent = friendlyError(error);
        return;
    }
    await renderSelectedThread();
}

async function toggleThreadPin(thread) {
    const { error } = await client
        .from("forum_threads")
        .update({ is_pinned: !thread.is_pinned, updated_at: new Date().toISOString() })
        .eq("id", thread.id);
    if (error) {
        setStatus(friendlyError(error));
        return;
    }
    await openThread(thread.id);
}

async function toggleCommentPin(commentId) {
    const comments = await fetchComments(state.selectedThread.id);
    const comment = comments.find((item) => item.id === commentId);
    const { error } = await client
        .from("forum_comments")
        .update({ is_pinned: !comment?.is_pinned, updated_at: new Date().toISOString() })
        .eq("id", commentId);
    if (error) {
        setStatus(friendlyError(error));
        return;
    }
    await renderSelectedThread();
}

async function voteComment(commentId, value) {
    if (!state.session) {
        window.location.href = "../admin/";
        return;
    }
    if (!isEmailConfirmed()) {
        setStatus("Confirm your email before voting.");
        return;
    }
    if (!isTrusted()) {
        setStatus("Voting opens after contributor validation.");
        return;
    }
    const { error } = await client.from("forum_comment_votes").upsert({
        comment_id: commentId,
        value,
        user_id: state.session.user.id,
    }, { onConflict: "comment_id,user_id" });
    if (error) {
        setStatus(error.message);
        return;
    }
    await renderSelectedThread();
}

function editThread(thread) {
    els.editId.value = thread.id;
    els.type.value = thread.type;
    els.audience.value = thread.audience || "public";
    els.audienceRow.hidden = !isAdmin();
    els.title.value = thread.title || "";
    els.tags.value = normalizeTags(thread.tags).join(", ");
    els.body.value = thread.body || "";
    els.image.value = "";
    els.imageUrl.value = thread.image_url || "";
    updateImagePreview(thread.image_url || "");
    els.submit.textContent = "Save forum post";
    els.cancelEdit.textContent = "Close";
    els.compose.hidden = false;
    els.compose.classList.add("is-open");
    els.postingAs.textContent = `Editing as ${displayName()}`;
}

async function loadThreadForEdit(id) {
    const { data, error } = await client
        .from("forum_threads")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        setStatus(friendlyError(error));
        return;
    }
    state.selectedThread = data;
    editThread(data);
}

async function deleteThread(id) {
    if (!window.confirm("Delete this forum post?")) return;
    const { error } = await client.from("forum_threads").delete().eq("id", id);
    if (error) {
        setStatus(error.message);
        return;
    }
    state.selectedThread = null;
    await loadThreads();
}

async function deleteComment(id) {
    if (!window.confirm("Delete this comment?")) return;
    const { error } = await client.from("forum_comments").delete().eq("id", id);
    if (error) {
        setStatus(error.message);
        return;
    }
    await renderSelectedThread();
}

async function reportContent({ threadId, commentId = null }) {
    if (!state.session) {
        window.location.href = "../admin/";
        return;
    }
    if (!isEmailConfirmed()) {
        setStatus("Confirm your email before reporting content.");
        return;
    }
    const reason = window.prompt("Why are you reporting this? Keep it short.");
    if (!reason?.trim()) return;
    const { error } = await client.from("forum_reports").insert({
        thread_id: threadId,
        comment_id: commentId,
        reason: reason.trim().slice(0, 500),
        username: displayName(),
    });
    if (error) {
        setStatus(friendlyError(error));
        return;
    }
    setStatus("Report sent to admin.");
}

async function openReports() {
    if (!isAdmin()) return;
    els.compose.hidden = true;
    els.compose.classList.remove("is-open");
    els.settingsPanel.hidden = true;
    els.settingsPanel.classList.remove("is-open");
    els.list.innerHTML = "";
    els.thread.hidden = false;
    els.thread.innerHTML = `
        <button class="back-link" type="button" data-back-forum>← Back</button>
        <section class="comments">
            <h2>Reports</h2>
            <p class="builder-status">Loading reports...</p>
        </section>
    `;
    els.thread.querySelector("[data-back-forum]").addEventListener("click", loadThreads);

    const { data, error } = await client
        .from("forum_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
    if (error) {
        els.thread.querySelector(".comments").innerHTML = `<h2>Reports</h2><p class="builder-status">${escapeHtml(friendlyError(error))}</p>`;
        return;
    }
    const reports = data || [];
    els.thread.querySelector(".comments").innerHTML = `
        <h2>Reports</h2>
        <div class="comment-list">
            ${reports.length ? reports.map(renderReport).join("") : '<p class="builder-status">No open reports.</p>'}
        </div>
    `;
    els.thread.querySelectorAll("[data-open-report-thread]").forEach((button) => {
        button.addEventListener("click", () => openThread(button.dataset.openReportThread));
    });
    els.thread.querySelectorAll("[data-dismiss-report]").forEach((button) => {
        button.addEventListener("click", () => dismissReport(button.dataset.dismissReport));
    });
}

function renderReport(report) {
    const target = report.comment_id ? "Comment" : "Forum post";
    return `
        <article class="comment report-card">
            <div></div>
            <div>
                <div class="forum-meta">${target} report · ${renderUsername(report.username || "Contributor", report.is_admin_author)} · ${formatDate(report.created_at)}</div>
                <p>${escapeHtml(report.reason)}</p>
                <div class="admin-post-actions">
                    ${report.thread_id ? `<button type="button" data-open-report-thread="${report.thread_id}">Open post</button>` : ""}
                    <button type="button" data-dismiss-report="${report.id}">Dismiss</button>
                </div>
            </div>
        </article>
    `;
}

async function dismissReport(id) {
    const { error } = await client
        .from("forum_reports")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) {
        setStatus(friendlyError(error));
        return;
    }
    await openReports();
}

async function submitThread(event) {
    event.preventDefault();
    if (!state.session) {
        window.location.href = "../admin/";
        return;
    }
    if (!isEmailConfirmed()) {
        els.composeStatus.textContent = "Confirm your email before posting.";
        return;
    }
    const title = els.title.value.trim();
    const body = els.body.value.trim();
    if (!title || !body) return;

    els.composeStatus.textContent = "Saving...";
    let imageUrl = els.imageUrl.value || "";
    if (els.image.files?.[0]) {
        els.composeStatus.textContent = "Uploading PNG...";
        try {
            imageUrl = await uploadForumImage(els.image.files[0], title);
        } catch (error) {
            els.composeStatus.textContent = error.message;
            return;
        }
    }
    const payload = {
        type: els.type.value,
        title,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        body,
        tags: normalizeTags(els.tags.value),
        image_url: imageUrl || null,
        username: displayName(),
        audience: isAdmin() ? els.audience.value : "public",
        status: isTrusted() ? "approved" : "pending",
        updated_at: new Date().toISOString(),
    };

    let result;
    const isNewThread = !els.editId.value;
    if (els.editId.value) {
        result = await client.from("forum_threads").update(payload).eq("id", els.editId.value).select("id").single();
    } else {
        result = await client.from("forum_threads").insert(payload).select("id").single();
    }
    if (result.error) {
        els.composeStatus.textContent = friendlyError(result.error);
        return;
    }

    state.tab = payload.type;
    await refreshProfile();
    resetCompose();
    await renderAccount();
    await loadThreads();
    if (!isTrusted() && isNewThread) {
        setStatus("Saved for admin validation. You can still open and edit it from Your forum space.");
        return;
    }
    if (isNewThread && result.data?.id) {
        await notifyNewForumPost(payload, result.data.id);
    }
    if (result.data?.id) await openThread(result.data.id);
}

async function notifyNewForumPost(payload, id) {
    const url = new URL(window.location.href);
    url.searchParams.set("thread", id);
    const notification = await client.functions.invoke("notify-new-post", {
        body: {
            title: payload.title,
            summary: payload.body.slice(0, 240),
            slug: payload.slug,
            url: url.href,
            type: payload.type,
            username: payload.username,
        },
    });
    if (notification.error) {
        els.composeStatus.textContent = `Saved, but email notification failed: ${notification.data?.error || notification.error.message}`;
    }
}

function openComposer() {
    if (!state.session) {
        window.location.href = "../admin/";
        return;
    }
    if (!isEmailConfirmed()) {
        window.location.href = "../admin/";
        return;
    }
    resetCompose();
    els.compose.hidden = false;
    els.compose.classList.add("is-open");
    els.settingsPanel.hidden = true;
    els.settingsPanel.classList.remove("is-open");
    els.thread.hidden = true;
    els.postingAs.textContent = isTrusted()
        ? `Posting as ${displayName()}`
        : `Posting as ${displayName()} · your post will go to admin for validation`;
}

function openSettings(force = false) {
    if (!state.session) {
        window.location.href = "../admin/";
        return;
    }
    els.compose.hidden = true;
    els.compose.classList.remove("is-open");
    els.thread.hidden = true;
    els.settingsPanel.hidden = false;
    els.settingsPanel.classList.add("is-open");
    els.settingsPanel.dataset.forceSettings = force ? "true" : "false";
    els.settingsClose.hidden = force;
    els.settingsIntro.textContent = force
        ? "Welcome in. Choose your username, then feel free to make a post, ask a question, or share a useful astronomy resource. Email notifications are still being tested."
        : "";
    els.settingsUsername.value = displayName();
    els.settingsNotifications.checked = state.profile?.notifications_enabled !== false;
    els.settingsStatus.textContent = "";
    els.settingsUsername.focus();
}

function updateImagePreview(url) {
    const img = els.imagePreview?.querySelector("img");
    if (!els.imagePreview || !img) return;
    if (!url) {
        els.imagePreview.hidden = true;
        img.removeAttribute("src");
        return;
    }
    img.src = url;
    els.imagePreview.hidden = false;
}

async function uploadForumImage(file, title) {
    if (file.type !== "image/png") {
        throw new Error("Please upload a PNG image.");
    }
    if (file.size > 5 * 1024 * 1024) {
        throw new Error("PNG must be 5 MB or smaller.");
    }
    const safeName = slugify(title || file.name.replace(/\.png$/i, ""));
    const path = `${state.session.user.id}/${Date.now()}-${safeName}.png`;
    const { error } = await client.storage
        .from(config.bucket)
        .upload(path, file, {
            contentType: "image/png",
            upsert: false,
        });
    if (error) throw new Error(friendlyError(error));
    const { data } = client.storage.from(config.bucket).getPublicUrl(path);
    return data.publicUrl;
}

function insertAtCursor(textarea, value) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
    textarea.value = `${before}${prefix}${value}${suffix}${after}`;
    const nextPosition = before.length + prefix.length + value.length;
    textarea.focus();
    textarea.setSelectionRange(nextPosition, nextPosition);
}

function cleanTableCell(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

function rowsToMarkdownTable(rows) {
    const cleaned = rows
        .map((row) => row.map(cleanTableCell))
        .filter((row) => row.some(Boolean));
    if (!cleaned.length) return "";
    const width = Math.max(...cleaned.map((row) => row.length));
    const normalized = cleaned.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
    const header = normalized[0];
    const separator = Array.from({ length: width }, () => "---");
    const body = normalized.slice(1);
    return [header, separator, ...body]
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n");
}

function tableFromHtml(html) {
    if (!html || !html.includes("<table")) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    const table = doc.querySelector("table");
    if (!table) return "";
    const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent)
    );
    return rowsToMarkdownTable(rows);
}

function tableFromPlainText(text) {
    const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2 || !lines.some((line) => line.includes("\t"))) return "";
    return rowsToMarkdownTable(lines.map((line) => line.split("\t")));
}

function handleBodyPaste(event) {
    const markdownTable = tableFromHtml(event.clipboardData?.getData("text/html"))
        || tableFromPlainText(event.clipboardData?.getData("text/plain"));
    if (!markdownTable) return;
    event.preventDefault();
    insertAtCursor(els.body, markdownTable);
    els.composeStatus.textContent = "Table inserted into content.";
}

async function insertInlineImages() {
    const files = Array.from(els.inlineImages.files || []);
    if (!files.length) return;
    if (!state.session?.user?.id) {
        els.composeStatus.textContent = "Sign in before adding images.";
        return;
    }
    els.composeStatus.textContent = files.length === 1 ? "Uploading inline PNG..." : `Uploading ${files.length} inline PNGs...`;
    try {
        const snippets = [];
        for (const file of files) {
            if (file.type !== "image/png") throw new Error("Please choose PNG images only.");
            const url = await uploadForumImage(file, els.title.value.trim() || file.name);
            const alt = file.name.replace(/\.png$/i, "").replace(/[-_]+/g, " ").trim() || "Forum image";
            snippets.push(`![${alt}](${url})`);
        }
        insertAtCursor(els.body, snippets.join("\n\n"));
        els.composeStatus.textContent = files.length === 1 ? "Image inserted into content." : "Images inserted into content.";
    } catch (error) {
        els.composeStatus.textContent = error.message;
    } finally {
        els.inlineImages.value = "";
    }
}

async function submitSettings(event) {
    event.preventDefault();
    const wasFirstSetup = els.settingsPanel.dataset.forceSettings === "true";
    const username = els.settingsUsername.value.trim();
    if (!username) {
        els.settingsStatus.textContent = "Username is required.";
        return;
    }
    if (!isAdmin() && username.toLowerCase().includes("admin")) {
        els.settingsStatus.textContent = "Only the HCNY Astro admin account can use admin in a username.";
        return;
    }
    els.settingsStatus.textContent = "Saving...";
    const { error } = await client
        .from("profiles")
        .update({
            username,
            notifications_enabled: els.settingsNotifications.checked,
            settings_completed: true,
        })
        .eq("id", state.session.user.id);
    if (error) {
        els.settingsStatus.textContent = friendlyError(error);
        return;
    }
    await refreshProfile();
    await renderAccount();
    els.settingsPanel.hidden = true;
    els.settingsPanel.classList.remove("is-open");
    await loadThreads();
    if (wasFirstSetup) {
        setStatus("Welcome. You are encouraged to make a post, share a resource, or ask your first astronomy question.");
    }
}

function closePostPanels() {
    els.settingsPanel.hidden = true;
    els.settingsPanel.classList.remove("is-open");
    els.welcomePopup.hidden = true;
    els.welcomePopup.classList.remove("is-open");
    resetCompose();
}

function openWelcomePopup() {
    els.compose.hidden = true;
    els.compose.classList.remove("is-open");
    els.settingsPanel.hidden = true;
    els.settingsPanel.classList.remove("is-open");
    els.thread.hidden = true;
    els.welcomePopup.hidden = false;
    els.welcomePopup.classList.add("is-open");
}

function continueFromWelcome() {
    els.welcomePopup.hidden = true;
    els.welcomePopup.classList.remove("is-open");
    openSettings(true);
}

async function init() {
    if (!app) return;
    if (!client) {
        await renderAccount();
        setStatus("Forum is not connected yet.");
        return;
    }

    const { data } = await client.auth.getSession();
    state.session = data.session;
    await refreshProfile();
    await renderAccount();
    resetCompose();
    document.querySelectorAll("[data-forum-tab]").forEach((button) => {
        button.addEventListener("click", async () => {
            state.tab = button.dataset.forumTab;
            document.querySelectorAll("[data-forum-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
            resetCompose();
            await loadThreads();
        });
    });
    els.compose.addEventListener("submit", submitThread);
    els.body.addEventListener("paste", handleBodyPaste);
    els.inlineImageButton.addEventListener("click", () => els.inlineImages.click());
    els.inlineImages.addEventListener("change", insertInlineImages);
    els.image.addEventListener("change", () => {
        const file = els.image.files?.[0];
        if (!file) {
            updateImagePreview(els.imageUrl.value || "");
            return;
        }
        if (file.type !== "image/png") {
            els.composeStatus.textContent = "Please choose a PNG image.";
            els.image.value = "";
            return;
        }
        updateImagePreview(URL.createObjectURL(file));
    });
    els.settingsPanel.addEventListener("submit", submitSettings);
    els.cancelEdit.addEventListener("click", closePostPanels);
    els.settingsClose.addEventListener("click", closePostPanels);
    els.welcomeContinue.addEventListener("click", continueFromWelcome);

    await loadThreads();
    if (state.session && state.profile && !state.profile.settings_completed) {
        openWelcomePopup();
    }
}

await init();
