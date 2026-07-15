import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEditablePage } from "./page-format.js";

const article = document.querySelector("[data-dynamic-page]");
const slug = article?.dataset.dynamicPage;
const client = article?.dataset.supabaseUrl && article?.dataset.supabaseKey
    ? createClient(article.dataset.supabaseUrl, article.dataset.supabaseKey)
    : null;

async function init() {
    if (!article || !slug || !client) return;
    const content = article.querySelector(".single-content");
    if (!content) return;

    const { data, error } = await client
        .from("content_pages")
        .select("title,body,updated_at")
        .eq("slug", slug)
        .maybeSingle();

    if (error || !data?.body) return;

    const title = article.querySelector("h1");
    if (title && data.title) title.textContent = data.title;
    content.innerHTML = renderEditablePage(data.body);
    article.dataset.dynamicLoaded = "true";
}

await init();
