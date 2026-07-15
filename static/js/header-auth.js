import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const link = document.querySelector("[data-header-auth]");

if (link?.dataset.supabaseUrl && link?.dataset.supabaseKey) {
    const client = createClient(link.dataset.supabaseUrl, link.dataset.supabaseKey);
    const { data } = await client.auth.getSession();

    if (data.session) {
        link.textContent = "Log out";
        link.setAttribute("aria-label", "Log out");
        link.addEventListener("click", async (event) => {
            event.preventDefault();
            link.textContent = "Logging out...";
            await client.auth.signOut();
            window.location.href = link.dataset.homeUrl || "/";
        });
    }
}
