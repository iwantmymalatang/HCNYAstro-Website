import { renderEditablePage } from "./page-format.js";

const article = document.querySelector("[data-dynamic-page]");
const slug = article?.dataset.dynamicPage;
const supabaseUrl = article?.dataset.supabaseUrl?.replace(/\/$/, "");
const supabaseKey = article?.dataset.supabaseKey;
let lastLoaded = "";

function setMessage(message) {
    const content = article.querySelector(".single-content");
    if (content) content.innerHTML = `<p>${message}</p>`;
}

async function loadDynamicPage({ force = false } = {}) {
    if (!article || !slug || !supabaseUrl || !supabaseKey) return;
    const content = article.querySelector(".single-content");
    if (!content) return;

    const url = `${supabaseUrl}/rest/v1/content_pages?slug=eq.${encodeURIComponent(slug)}&select=title,body,updated_at`;
    let response;
    try {
        response = await fetch(url, {
            method: "GET",
            cache: "reload",
            headers: { apikey: supabaseKey },
        });
    } catch (error) {
        setMessage("Dynamic content could not load. Refresh the page in a moment.");
        return;
    }

    if (!response.ok) {
        setMessage(`Dynamic content could not load. Supabase returned ${response.status}.`);
        return;
    }

    const rows = await response.json();
    const data = rows?.[0];
    if (!data?.body) {
        setMessage("No dynamic content has been saved for this page yet.");
        return;
    }

    const loadedKey = `${data.updated_at || ""}:${data.body}`;
    if (!force && loadedKey === lastLoaded) return;
    lastLoaded = loadedKey;

    const title = article.querySelector("h1");
    if (title && data.title) title.textContent = data.title;
    content.innerHTML = renderEditablePage(data.body);
    article.dataset.dynamicLoaded = "true";
    article.dataset.dynamicUpdatedAt = data.updated_at || "";
}

await loadDynamicPage({ force: true });

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadDynamicPage();
});

window.addEventListener("focus", () => loadDynamicPage());
setInterval(() => loadDynamicPage(), 15000);
