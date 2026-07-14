import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const app = document.getElementById("forum-app");
const config = {
    url: app?.dataset.supabaseUrl?.trim() || "",
    key: app?.dataset.supabaseKey?.trim() || "",
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
    list: document.getElementById("forum-list"),
    thread: document.getElementById("forum-thread"),
    newPost: document.getElementById("forum-new-post"),
    settingsPanel: document.getElementById("forum-settings-panel"),
    settingsUsername: document.getElementById("forum-settings-username"),
    settingsNotifications: document.getElementById("forum-settings-notifications"),
    settingsStatus: document.getElementById("forum-settings-status"),
    settingsClose: document.getElementById("forum-settings-close"),
    editId: document.getElementById("forum-edit-id"),
    type: document.getElementById("forum-type"),
    postingAs: document.getElementById("forum-posting-as"),
    title: document.getElementById("forum-title"),
    tags: document.getElementById("forum-tags"),
    body: document.getElementById("forum-body"),
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

function isHcnyAdmin() {
    const email = (state.session?.user?.email || state.profile?.email || "").toLowerCase();
    return email === "hcnyastro@gmail.com";
}

function isAdmin() {
    return isHcnyAdmin() || state.profile?.role === "admin";
}

function isEmailConfirmed() {
    return Boolean(state.session?.user?.email_confirmed_at || state.session?.user?.confirmed_at);
}

function canEdit(row) {
    return isAdmin() || row.created_by === state.session?.user?.id;
}

function canDeleteComment(comment) {
    return isAdmin() || comment.created_by === state.session?.user?.id;
}

function displayName() {
    return state.profile?.username || state.session?.user?.email?.split("@")[0] || "Contributor";
}

function resetCompose() {
    els.compose.reset();
    els.editId.value = "";
    els.type.value = state.tab;
    els.submit.textContent = "Publish to forum";
    els.cancelEdit.textContent = "Close";
    els.composeStatus.textContent = "";
    els.postingAs.textContent = state.session ? `Posting as ${displayName()}` : "";
    els.compose.hidden = true;
    els.compose.classList.remove("is-open");
}

function setStatus(message) {
    els.status.textContent = message || "";
    els.status.hidden = !message;
}

async function refreshProfile() {
    if (!state.session) {
        state.profile = null;
        return;
    }

    const { data, error } = await client
        .from("profiles")
        .select("id,email,username,role,notifications_enabled")
        .eq("id", state.session.user.id)
        .single();
    if (error) {
        state.profile = {
            id: state.session.user.id,
            email: state.session.user.email,
            username: state.session.user.email?.split("@")[0] || "Contributor",
            role: "contributor",
            notifications_enabled: true,
        };
        return;
    }
    state.profile = data;
    if (isHcnyAdmin()) {
        state.profile = { ...state.profile, role: "admin", email: state.session.user.email || state.profile.email };
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
        <span>${escapeHtml(displayName())}</span>
        ${isAdmin() ? '<strong>Admin</strong>' : '<strong>Contributor</strong>'}
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
    els.thread.hidden = true;

    const { data, error } = await client
        .from("forum_threads_with_counts")
        .select("id,slug,type,title,body,tags,username,created_by,created_at,updated_at,comment_count")
        .eq("type", state.tab)
        .order("updated_at", { ascending: false });

    if (error) {
        els.list.innerHTML = "";
        setStatus(friendlyError(error));
        return;
    }

    state.threads = data || [];
    setStatus("");
    renderThreadList();
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
        <article class="post-card forum-card" data-thread-id="${thread.id}">
            <div>
                <time>${formatDate(thread.created_at)}</time>
                <h2><button type="button" data-open-thread="${thread.id}">${escapeHtml(thread.title)}</button></h2>
                ${renderTags(thread.tags)}
                <p>${escapeHtml(thread.body).slice(0, 220)}${thread.body?.length > 220 ? "..." : ""}</p>
                <span class="forum-meta">By ${escapeHtml(thread.username || "Contributor")} · ${thread.comment_count || 0} comments</span>
            </div>
            <button class="read-link" type="button" data-open-thread="${thread.id}">Open</button>
        </article>
    `).join("");

    els.list.querySelectorAll("[data-open-thread]").forEach((button) => {
        button.addEventListener("click", () => openThread(button.dataset.openThread));
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
    els.list.innerHTML = "";
    els.thread.hidden = false;
    await renderSelectedThread();
}

async function fetchComments(threadId) {
    const { data, error } = await client
        .from("forum_comments_with_scores")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
    if (error) throw new Error(friendlyError(error));
    return data || [];
}

function sortTopComments(comments) {
    return [...comments].sort((a, b) => {
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
    const actions = canEdit(thread)
        ? `<button type="button" data-edit-thread>Edit</button>${isAdmin() ? '<button type="button" data-delete-thread>Delete</button>' : ""}`
        : "";
    const reportThreadAction = state.session
        ? '<button type="button" data-report-thread>Report</button>'
        : "";
    const commentForm = state.session && isEmailConfirmed()
        ? `<form class="comment-form" id="comment-form">
                <label>
                    <span>Comment as ${escapeHtml(displayName())}</span>
                    <textarea id="comment-body" rows="4" placeholder="Add a comment..." required></textarea>
                </label>
                <div class="builder-actions"><button type="submit">Comment</button></div>
                <p class="builder-status" id="comment-status"></p>
            </form>`
        : state.session
            ? '<p class="builder-status">Confirm your email to comment and vote.</p>'
            : '<p class="builder-status"><a href="../admin/">Sign in</a> to comment and vote.</p>';

    els.thread.innerHTML = `
        <button class="back-link" type="button" data-back-forum>← Back</button>
        <header class="single-head">
            <time>${formatDate(thread.created_at)}</time>
            <h1>${escapeHtml(thread.title)}</h1>
            ${renderTags(thread.tags)}
            <p class="forum-meta">By ${escapeHtml(thread.username || "Contributor")}</p>
            <div class="admin-post-actions">${actions}${reportThreadAction}</div>
        </header>
        <div class="single-content">${renderBody(thread.body)}</div>
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
}

function renderComment(comment, groups, depth) {
    const replies = (groups.get(comment.id) || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const deleteAction = canDeleteComment(comment)
        ? `<button type="button" data-delete-comment="${comment.id}">Delete</button>`
        : "";
    const actions = state.session
        ? `<button type="button" data-reply-comment="${comment.id}">Reply</button><button type="button" data-report-comment="${comment.id}">Report</button>${deleteAction}`
        : "";
    const replyForm = state.session
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
                    <button type="button" data-vote-comment="${comment.id}" data-vote-value="1">▲</button>
                    <strong>${comment.score || 0}</strong>
                    <button type="button" data-vote-comment="${comment.id}" data-vote-value="-1">▼</button>
                </div>
                <div>
                    <div class="forum-meta">${escapeHtml(comment.username || "Contributor")} · ${formatDate(comment.created_at)}</div>
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
    const body = form.querySelector('[name="comment-body"], #comment-body')?.value.trim();
    if (!body) return;
    status.textContent = "Saving comment...";
    const { error } = await client.from("forum_comments").insert({
        thread_id: state.selectedThread.id,
        parent_id: parentId,
        body,
        username: displayName(),
    });
    if (error) {
        status.textContent = error.message;
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
    els.title.value = thread.title || "";
    els.tags.value = normalizeTags(thread.tags).join(", ");
    els.body.value = thread.body || "";
    els.submit.textContent = "Save forum post";
    els.cancelEdit.textContent = "Close";
    els.compose.hidden = false;
    els.compose.classList.add("is-open");
    els.postingAs.textContent = `Editing as ${displayName()}`;
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
        .select("id,thread_id,comment_id,reason,status,username,created_at")
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
                <div class="forum-meta">${target} report · ${escapeHtml(report.username || "Contributor")} · ${formatDate(report.created_at)}</div>
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
    const payload = {
        type: els.type.value,
        title,
        slug: `${slugify(title)}-${Date.now().toString(36)}`,
        body,
        tags: normalizeTags(els.tags.value),
        username: displayName(),
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
    els.postingAs.textContent = `Posting as ${displayName()}`;
}

function openSettings() {
    if (!state.session) {
        window.location.href = "../admin/";
        return;
    }
    els.compose.hidden = true;
    els.compose.classList.remove("is-open");
    els.thread.hidden = true;
    els.settingsPanel.hidden = false;
    els.settingsPanel.classList.add("is-open");
    els.settingsUsername.value = displayName();
    els.settingsNotifications.checked = state.profile?.notifications_enabled !== false;
    els.settingsStatus.textContent = "";
    els.settingsUsername.focus();
}

async function submitSettings(event) {
    event.preventDefault();
    const username = els.settingsUsername.value.trim();
    if (!username) {
        els.settingsStatus.textContent = "Username is required.";
        return;
    }
    els.settingsStatus.textContent = "Saving...";
    const { error } = await client
        .from("profiles")
        .update({
            username,
            notifications_enabled: els.settingsNotifications.checked,
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
}

function closePostPanels() {
    els.settingsPanel.hidden = true;
    els.settingsPanel.classList.remove("is-open");
    resetCompose();
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
    els.settingsPanel.addEventListener("submit", submitSettings);
    els.cancelEdit.addEventListener("click", closePostPanels);
    els.settingsClose.addEventListener("click", closePostPanels);

    await loadThreads();
}

await init();
