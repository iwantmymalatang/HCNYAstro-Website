import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, renderEditablePage } from "./page-format.js";

const mount = document.getElementById("admin-dashboard");
const client = mount?.dataset.supabaseUrl && mount?.dataset.supabaseKey
    ? createClient(mount.dataset.supabaseUrl, mount.dataset.supabaseKey)
    : null;

const els = {
    gate: document.getElementById("admin-gate"),
    body: document.getElementById("admin-dashboard-body"),
    name: document.getElementById("admin-name"),
    email: document.getElementById("admin-email"),
    refresh: document.getElementById("admin-refresh"),
    exportTrusted: document.getElementById("admin-export-trusted"),
    logout: document.getElementById("admin-logout"),
    metrics: {
        users: document.getElementById("metric-users"),
        posts: document.getElementById("metric-posts"),
        comments: document.getElementById("metric-comments"),
        reports: document.getElementById("metric-reports"),
    },
    counts: {
        reports: document.getElementById("reports-count"),
        users: document.getElementById("users-count"),
        posts: document.getElementById("posts-count"),
        comments: document.getElementById("comments-count"),
        messages: document.getElementById("messages-count"),
    },
    reports: document.getElementById("admin-reports"),
    messages: document.getElementById("admin-messages"),
    users: document.getElementById("admin-users"),
    posts: document.getElementById("admin-posts"),
    comments: document.getElementById("admin-comments"),
    pageEditor: {
        slug: document.getElementById("page-editor-slug"),
        title: document.getElementById("page-editor-title"),
        body: document.getElementById("page-editor-body"),
        save: document.getElementById("page-editor-save"),
        status: document.getElementById("page-editor-status"),
        preview: document.getElementById("page-editor-preview"),
    },
};

const state = {
    session: null,
    profile: null,
};

const pageFallbacks = {
    about: { title: "About", body: "" },
    repository: { title: "Repository", body: "" },
};

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-SG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Singapore",
    }).format(date);
}

function setGate(message, action = "") {
    els.gate.innerHTML = `<p class="builder-status">${escapeHtml(message)}</p>${action}`;
    els.gate.hidden = false;
    els.body.hidden = true;
}

function isAdmin() {
    const email = (state.session?.user?.email || state.profile?.email || "").toLowerCase();
    return email === "hcnyastro@gmail.com" || state.profile?.role === "admin";
}

async function loadProfile() {
    const { data, error } = await client
        .from("profiles")
        .select("id,email,username,role,trust_status,settings_completed,notifications_enabled,created_at")
        .eq("id", state.session.user.id)
        .single();
    if (error) {
        const repaired = await client.rpc("ensure_profile");
        if (repaired.error) {
            state.profile = {
                id: state.session.user.id,
                email: state.session.user.email,
                username: state.session.user.email?.split("@")[0] || "Admin",
                role: "contributor",
                trust_status: "untrusted",
            };
            return;
        }
        state.profile = repaired.data;
        return;
    }
    state.profile = data;
}

async function countRows(table, filter = null) {
    let query = client.from(table).select("*", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

function empty(message) {
    return `<p class="builder-status">${escapeHtml(message)}</p>`;
}

function renderReports(reports) {
    els.counts.reports.textContent = `${reports.length} open`;
    els.reports.innerHTML = reports.length ? reports.map((report) => {
        const target = report.comment_id ? "Comment" : "Forum post";
        return `
            <article class="admin-row">
                <div>
                    <strong>${target}</strong>
                    <span>${escapeHtml(report.username || "Contributor")} · ${formatDate(report.created_at)}</span>
                    <p>${escapeHtml(report.reason)}</p>
                </div>
                <div class="admin-post-actions">
                    ${report.thread_id ? `<a class="read-link" href="../forum/?thread=${encodeURIComponent(report.thread_id)}">Open</a>` : ""}
                    <button type="button" data-dismiss-report="${report.id}">Dismiss</button>
                </div>
            </article>
        `;
    }).join("") : empty("No open reports.");

    els.reports.querySelectorAll("[data-dismiss-report]").forEach((button) => {
        button.addEventListener("click", () => dismissReport(button.dataset.dismissReport));
    });
}

function renderMessages(messages) {
    els.counts.messages.textContent = `${messages.length} open`;
    els.messages.innerHTML = messages.length ? messages.map((message) => `
        <article class="admin-row">
            <div>
                <strong>${escapeHtml(message.kind === "trust_application" ? "Trust application" : "Message")}</strong>
                <span>${escapeHtml(message.username || "Contributor")} · ${formatDate(message.created_at)}</span>
                <p>${escapeHtml(message.message)}</p>
            </div>
            <div class="admin-post-actions">
                ${message.user_id ? `<button type="button" data-message-trust="${message.user_id}" data-message-id="${message.id}">Trust user</button>` : ""}
                <button type="button" data-close-message="${message.id}">Close</button>
            </div>
        </article>
    `).join("") : empty("No open messages.");

    els.messages.querySelectorAll("[data-message-trust]").forEach((button) => {
        button.addEventListener("click", () => trustFromMessage(button.dataset.messageTrust, button.dataset.messageId));
    });
    els.messages.querySelectorAll("[data-close-message]").forEach((button) => {
        button.addEventListener("click", () => closeMessage(button.dataset.closeMessage));
    });
}

function renderUsers(users) {
    els.counts.users.textContent = `${users.length} shown`;
    els.users.innerHTML = users.length ? users.map((user) => {
        const trust = user.trust_status || (user.role === "admin" ? "trusted" : "untrusted");
        const trustLabel = trust === "trusted" ? "validated contributor" : "new contributor";
        const isProtectedAdmin = (user.email || "").toLowerCase() === "hcnyastro@gmail.com";
        return `
            <article class="admin-row">
                <div>
                    <strong>${escapeHtml(user.username || user.email || "User")}</strong>
                    <span>${escapeHtml(user.email || "No email")} · ${escapeHtml(user.role || "contributor")} · ${escapeHtml(trustLabel)}</span>
                    <p>${user.notifications_enabled === false ? "Email updates off" : "Email updates on"} · ${user.settings_completed ? "settings done" : "settings not done"} · Joined ${formatDate(user.created_at)}</p>
                </div>
                <div class="admin-post-actions">
                    ${isProtectedAdmin ? '<strong>Admin</strong>' : trust === "trusted"
                        ? `<button type="button" data-user-trust="${user.id}" data-trust-value="untrusted">Move to new contributor</button>`
                        : `<button type="button" data-user-trust="${user.id}" data-trust-value="trusted">Validate contributor</button>`}
                </div>
            </article>
        `;
    }).join("") : empty("No users found.");

    els.users.querySelectorAll("[data-user-trust]").forEach((button) => {
        button.addEventListener("click", () => updateUserTrust(button.dataset.userTrust, button.dataset.trustValue));
    });
}

function renderPosts(posts) {
    els.counts.posts.textContent = `${posts.length} recent`;
    els.posts.innerHTML = posts.length ? posts.map((post) => {
        const status = post.status || "approved";
        const statusLabel = status === "approved" ? "validated" : status === "rejected" ? "needs changes" : "waiting for validation";
        return `
            <article class="admin-row">
                <div>
                    <strong>${escapeHtml(post.title)}</strong>
                    <span>${escapeHtml(post.type)} · ${escapeHtml(statusLabel)} · ${post.audience === "trusted" ? "validated contributors only · " : ""}${post.is_pinned ? "pinned · " : ""}${escapeHtml(post.username || "Contributor")} · ${formatDate(post.created_at)}</span>
                    <p>${escapeHtml(post.body).slice(0, 140)}${post.body?.length > 140 ? "..." : ""}</p>
                </div>
                <div class="admin-post-actions">
                    ${status === "pending" ? `<button type="button" data-approve-post="${post.id}">Validate</button><button type="button" data-reject-post="${post.id}">Needs changes</button>` : ""}
                    ${status === "rejected" ? `<button type="button" data-pending-post="${post.id}">Return to validation</button>` : ""}
                    <button type="button" data-pin-post="${post.id}" data-pin-value="${post.is_pinned ? "false" : "true"}">${post.is_pinned ? "Unpin" : "Pin"}</button>
                    <a class="read-link" href="../forum/?thread=${encodeURIComponent(post.id)}">Open</a>
                    <button type="button" data-delete-post="${post.id}">Delete</button>
                </div>
            </article>
        `;
    }).join("") : empty("No posts yet.");

    els.posts.querySelectorAll("[data-approve-post]").forEach((button) => {
        button.addEventListener("click", () => updatePostStatus(button.dataset.approvePost, "approved"));
    });
    els.posts.querySelectorAll("[data-reject-post]").forEach((button) => {
        button.addEventListener("click", () => updatePostStatus(button.dataset.rejectPost, "rejected"));
    });
    els.posts.querySelectorAll("[data-pending-post]").forEach((button) => {
        button.addEventListener("click", () => updatePostStatus(button.dataset.pendingPost, "pending"));
    });
    els.posts.querySelectorAll("[data-delete-post]").forEach((button) => {
        button.addEventListener("click", () => deletePost(button.dataset.deletePost));
    });
    els.posts.querySelectorAll("[data-pin-post]").forEach((button) => {
        button.addEventListener("click", () => updatePostPin(button.dataset.pinPost, button.dataset.pinValue === "true"));
    });
}

function renderComments(comments) {
    els.counts.comments.textContent = `${comments.length} recent`;
    els.comments.innerHTML = comments.length ? comments.map((comment) => `
        <article class="admin-row">
            <div>
                <strong>${escapeHtml(comment.username || "Contributor")}</strong>
                <span>${formatDate(comment.created_at)} · score ${comment.score || 0}</span>
                <p>${escapeHtml(comment.body).slice(0, 160)}${comment.body?.length > 160 ? "..." : ""}</p>
            </div>
            <a class="read-link" href="../forum/?thread=${encodeURIComponent(comment.thread_id)}">Open</a>
        </article>
    `).join("") : empty("No comments yet.");
}

function updatePagePreview() {
    els.pageEditor.preview.innerHTML = renderEditablePage(els.pageEditor.body.value);
}

function setPageEditorStatus(message) {
    els.pageEditor.status.textContent = message || "";
}

async function loadEditablePage() {
    const slug = els.pageEditor.slug.value;
    setPageEditorStatus("Loading...");
    const fallback = pageFallbacks[slug] || { title: slug, body: "" };

    const { data, error } = await client
        .from("content_pages")
        .select("slug,title,body,updated_at")
        .eq("slug", slug)
        .maybeSingle();

    if (error) {
        els.pageEditor.title.value = fallback.title;
        els.pageEditor.body.value = fallback.body;
        updatePagePreview();
        setPageEditorStatus("Run supabase-dynamic-pages.sql to enable saving.");
        return;
    }

    els.pageEditor.title.value = data?.title || fallback.title;
    els.pageEditor.body.value = data?.body || fallback.body;
    updatePagePreview();
    setPageEditorStatus(data?.updated_at ? `Loaded ${formatDate(data.updated_at)}` : "Loaded fallback draft");
}

async function saveEditablePage() {
    const slug = els.pageEditor.slug.value;
    const title = els.pageEditor.title.value.trim() || (pageFallbacks[slug]?.title || slug);
    const body = els.pageEditor.body.value.trim();
    if (!body) {
        setPageEditorStatus("Content cannot be empty.");
        return;
    }

    els.pageEditor.save.disabled = true;
    setPageEditorStatus("Saving...");
    const { error } = await client.from("content_pages").upsert({
        slug,
        title,
        body,
        updated_by: state.session.user.id,
        updated_at: new Date().toISOString(),
    }, { onConflict: "slug" });

    els.pageEditor.save.disabled = false;
    if (error) {
        setPageEditorStatus(error.message || "Could not save page.");
        return;
    }
    setPageEditorStatus("Saved. Refresh the public page to see it.");
}

async function loadDashboard() {
    els.body.classList.add("is-loading");
    try {
        const [userCount, postCount, commentCount, reportCount] = await Promise.all([
            countRows("profiles"),
            countRows("forum_threads"),
            countRows("forum_comments"),
            countRows("forum_reports", (query) => query.eq("status", "open")),
        ]);

        els.metrics.users.textContent = userCount;
        els.metrics.posts.textContent = postCount;
        els.metrics.comments.textContent = commentCount;
        els.metrics.reports.textContent = reportCount;

        const [reportsResult, messagesResult, usersResult, pendingPostsResult, postsResult, commentsResult] = await Promise.all([
            client.from("forum_reports").select("id,thread_id,comment_id,reason,status,username,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(20),
            client.from("forum_admin_messages").select("id,user_id,kind,message,status,username,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(30),
            client.from("profiles").select("id,email,username,role,trust_status,settings_completed,notifications_enabled,created_at").order("created_at", { ascending: false }).limit(50),
            client.from("forum_threads").select("id,type,title,body,username,status,audience,is_pinned,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(20),
            client.from("forum_threads").select("id,type,title,body,username,status,audience,is_pinned,created_at").neq("status", "pending").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(10),
            client.from("forum_comments_with_scores").select("id,thread_id,body,username,created_at,score").order("created_at", { ascending: false }).limit(10),
        ]);

        for (const result of [reportsResult, messagesResult, usersResult, pendingPostsResult, postsResult, commentsResult]) {
            if (result.error) throw result.error;
        }

        renderReports(reportsResult.data || []);
        renderMessages(messagesResult.data || []);
        renderUsers(usersResult.data || []);
        renderPosts([...(pendingPostsResult.data || []), ...(postsResult.data || [])]);
        renderComments(commentsResult.data || []);
        await loadEditablePage();
    } catch (error) {
        setGate(error.message || "Could not load admin dashboard.");
    } finally {
        els.body.classList.remove("is-loading");
    }
}

async function updateUserTrust(id, trustStatus) {
    const { error } = await client
        .from("profiles")
        .update({ trust_status: trustStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) {
        setGate(error.message || "Could not update user trust.");
        return;
    }
    await loadDashboard();
}

async function updatePostStatus(id, status) {
    const { error } = await client
        .from("forum_threads")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) {
        setGate(error.message || "Could not update post.");
        return;
    }
    await loadDashboard();
}

async function updatePostPin(id, isPinned) {
    const { error } = await client
        .from("forum_threads")
        .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) {
        setGate(error.message || "Could not pin post.");
        return;
    }
    await loadDashboard();
}

async function closeMessage(id) {
    const { error } = await client
        .from("forum_admin_messages")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) {
        setGate(error.message || "Could not close message.");
        return;
    }
    await loadDashboard();
}

async function trustFromMessage(userId, messageId) {
    await updateUserTrust(userId, "trusted");
    await closeMessage(messageId);
}

async function exportTrustedEmails() {
    const { data, error } = await client
        .from("profiles")
        .select("email,username,trust_status")
        .eq("trust_status", "trusted")
        .order("email", { ascending: true });
    if (error) {
        setGate(error.message || "Could not export trusted users.");
        return;
    }
    const rows = [["email", "username", "trust_status"], ...(data || []).map((user) => [user.email || "", user.username || "", user.trust_status || ""])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "trusted-users.csv";
    link.click();
    URL.revokeObjectURL(link.href);
}

async function deletePost(id) {
    if (!window.confirm("Delete this forum post?")) return;
    const { error } = await client.from("forum_threads").delete().eq("id", id);
    if (error) {
        setGate(error.message || "Could not delete post.");
        return;
    }
    await loadDashboard();
}

async function dismissReport(id) {
    const { error } = await client
        .from("forum_reports")
        .update({ status: "dismissed", updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) {
        setGate(error.message || "Could not dismiss report.");
        return;
    }
    await loadDashboard();
}

async function init() {
    if (!mount) return;
    if (!client) {
        setGate("Admin dashboard is not connected.");
        return;
    }

    const { data } = await client.auth.getSession();
    state.session = data.session;
    if (!state.session) {
        setGate("Sign in as admin to continue.", '<a class="read-link" href="../admin/">Login</a>');
        return;
    }

    await loadProfile();
    if (!isAdmin()) {
        setGate("Admin access only. This page is restricted to hcnyastro@gmail.com.");
        return;
    }

    els.gate.hidden = true;
    els.body.hidden = false;
    els.name.textContent = state.profile?.username || "HCNY Astro Admin";
    els.email.textContent = state.profile?.email || state.session.user.email || "";

    els.refresh.addEventListener("click", loadDashboard);
    els.exportTrusted.addEventListener("click", exportTrustedEmails);
    els.pageEditor.slug.addEventListener("change", loadEditablePage);
    els.pageEditor.body.addEventListener("input", updatePagePreview);
    els.pageEditor.title.addEventListener("input", updatePagePreview);
    els.pageEditor.save.addEventListener("click", saveEditablePage);
    els.logout.addEventListener("click", async () => {
        await client.auth.signOut();
        window.location.href = "../admin/";
    });

    await loadDashboard();
}

await init();
