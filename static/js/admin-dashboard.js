import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    },
    reports: document.getElementById("admin-reports"),
    users: document.getElementById("admin-users"),
    posts: document.getElementById("admin-posts"),
    comments: document.getElementById("admin-comments"),
};

const state = {
    session: null,
    profile: null,
};

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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
        .select("id,email,username,role,notifications_enabled,created_at")
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

function renderUsers(users) {
    els.counts.users.textContent = `${users.length} shown`;
    els.users.innerHTML = users.length ? users.map((user) => `
        <article class="admin-row">
            <div>
                <strong>${escapeHtml(user.username || user.email || "User")}</strong>
                <span>${escapeHtml(user.email || "No email")} · ${escapeHtml(user.role || "contributor")}</span>
                <p>${user.notifications_enabled === false ? "Email updates off" : "Email updates on"} · Joined ${formatDate(user.created_at)}</p>
            </div>
        </article>
    `).join("") : empty("No users found.");
}

function renderPosts(posts) {
    els.counts.posts.textContent = `${posts.length} recent`;
    els.posts.innerHTML = posts.length ? posts.map((post) => `
        <article class="admin-row">
            <div>
                <strong>${escapeHtml(post.title)}</strong>
                <span>${escapeHtml(post.type)} · ${escapeHtml(post.username || "Contributor")} · ${formatDate(post.created_at)}</span>
                <p>${escapeHtml(post.body).slice(0, 140)}${post.body?.length > 140 ? "..." : ""}</p>
            </div>
            <a class="read-link" href="../forum/?thread=${encodeURIComponent(post.id)}">Open</a>
        </article>
    `).join("") : empty("No posts yet.");
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

        const [reportsResult, usersResult, postsResult, commentsResult] = await Promise.all([
            client.from("forum_reports").select("id,thread_id,comment_id,reason,status,username,created_at").eq("status", "open").order("created_at", { ascending: false }).limit(20),
            client.from("profiles").select("id,email,username,role,notifications_enabled,created_at").order("created_at", { ascending: false }).limit(50),
            client.from("forum_threads").select("id,type,title,body,username,created_at").order("created_at", { ascending: false }).limit(10),
            client.from("forum_comments_with_scores").select("id,thread_id,body,username,created_at,score").order("created_at", { ascending: false }).limit(10),
        ]);

        for (const result of [reportsResult, usersResult, postsResult, commentsResult]) {
            if (result.error) throw result.error;
        }

        renderReports(reportsResult.data || []);
        renderUsers(usersResult.data || []);
        renderPosts(postsResult.data || []);
        renderComments(commentsResult.data || []);
    } catch (error) {
        setGate(error.message || "Could not load admin dashboard.");
    } finally {
        els.body.classList.remove("is-loading");
    }
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
    els.logout.addEventListener("click", async () => {
        await client.auth.signOut();
        window.location.href = "../admin/";
    });

    await loadDashboard();
}

await init();
