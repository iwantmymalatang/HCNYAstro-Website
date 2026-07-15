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
    about: {
        title: "About",
        body: `HCNYAstro is an astronomy interest group from Hwa Chong Institution (High School) and Nanyang Girls' High School.

We collect resources for students to learn more about astronomy, organise events such as stargazing to give students a chance at practical experiences, and other lessons.

The interest group has a long history going far back, even before the 2020s. Originally, it started as a small, informal interest group that emerged from the pure love of astronomy, with a few people hosting sessions where HCIHS students would go over to the JC Astro club and sit in on their lessons.

HCNYAstro was founded in its current form in 2021 when the HS Astronomy interest group expanded to encompass NYGH as well, under the guidance of our senior Tey Yi Fan (graduated 2022). From there, it grew into its own independent interest group, organising its own online lessons, practical sessions, and even collaborating with other schools.

We hope that in the years to come, the interest group will continue to spark a love for astronomy in many more generations of young astronomers, from HCI, NYGH, and the rest of Singapore.

*Our current EXCO line-up*

- Wang Xingshuo, HCI
- Ng Chyng Yi, NYGH
- Nay Myo Win, HCI
- Teh Jiaying, NYGH
- Loke Kei Nga Tricia, NYGH
- Zhao Wenying, NYGH
- Liu Haochen, HCI`,
    },
    repository: {
        title: "Repository",
        body: `*Resources*

[AOGuide][https://www.aoguide.app/] contains the core astronomy olympiad content you will need. It is strongest as a reference, so use the handouts and practice materials alongside it for olympiad technique.

*Handouts*

To be added soon

[Handout explanation videos][https://www.aoguide.app/] are December 2026 training resources prepared for HCNY Astronomy contributors.

*Lesson slides and materials*

Open the [lesson slides and materials][https://drive.google.com/drive/folders/11fzTbXRS3pTrSB5io9DIzJJqmk0Y2_7j?usp=drive_link] folder for class slides, worksheets, and extra lesson materials.

- [HCNYAstro Session 1][https://docs.google.com/presentation/d/1e_t3ULCi6ijZcE73-1k4_UN_SuuyT6LzJFOwCDd2g6w/edit?usp=drive_web]
- [HCNYAstro Session 2][https://docs.google.com/presentation/d/1EQnfo_FA1UNS9HjMl3rysR4F2O2CLL7aeagkw5tSFJk/edit?usp=drive_web]
- [COM Session 1: Centre of Mass][https://docs.google.com/presentation/d/1-H0OFl6gO9_XGZTgzlqLa2xzynD_i77Za2AZCmOXi8A/edit?usp=drive_web]
- [HCNY Session 4][https://docs.google.com/presentation/d/1a6HJCLElkrimyBBRKaw137ZyUyIcqiqjYCs63K6pugY/edit?usp=drive_web]
- [HCNY Session 4 Final Version][https://docs.google.com/presentation/d/1quKnZl74dr9tznAyepwtp6qVe0Wy4-aqSFX4Tebm7vU/edit?usp=drive_web]
- [Prerequisite Mechanics for HCNY Astro][https://docs.google.com/presentation/d/1xRxJJrZyTPVHY0u0ooZTqfCkak07_Gh5x09r2G0KVdc/edit?usp=drive_web]
- [Prerequisite Mechanics (Simplified)][https://docs.google.com/presentation/d/1LuJcgeLFQJcY9OkRdGHtIA0fzLMhQrjopXqw_j6xmOY/edit?usp=drive_web]
- [Celestial Mechanics (All)][https://docs.google.com/presentation/d/1TAZdBWjSx2xzm0sYXhiR6xviq3uIiOBW1lq_L1ZDJ58/edit?usp=drive_web]
- [Relativity][https://docs.google.com/presentation/d/1MHSKJTDXFXbXp9K7FLfAExN6C33r7FoM3p_XNV2SFFU/edit?usp=drive_web]`,
    },
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
        await loadEditablePage();
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
