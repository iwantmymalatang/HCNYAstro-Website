import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const mount = document.getElementById("dynamic-login");
const client = mount?.dataset.supabaseUrl && mount?.dataset.supabaseKey
    ? createClient(mount.dataset.supabaseUrl, mount.dataset.supabaseKey)
    : null;

const form = document.getElementById("dynamic-login-form");
const status = document.getElementById("login-status");
const submitButton = document.getElementById("login-submit-button");
const editorUrl = mount?.dataset.editorUrl || "../forum/";
const adminUrl = mount?.dataset.adminUrl || "../admin-dashboard/";
const loginUrl = mount?.dataset.loginUrl || window.location.href;

function authErrorMessage(error) {
    const message = error?.message || String(error || "");
    const lower = message.toLowerCase();
    if (lower.includes("rate") && lower.includes("email")) {
        return "Supabase email limit reached. Try again later, or check custom SMTP in Supabase Authentication settings.";
    }
    if (lower.includes("smtp") || lower.includes("email provider") || lower.includes("failed to send")) {
        return "Supabase could not send the email. Check custom SMTP settings and Authentication logs.";
    }
    return message;
}

function destinationForEmail(email) {
    return String(email || "").toLowerCase() === "hcnyastro@gmail.com" ? adminUrl : editorUrl;
}

function withTimeout(promise, milliseconds, message) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function ensureProfile() {
    const { error } = await client.rpc("ensure_profile");
    if (error) {
        status.textContent = "Signed in, but profile setup needs the latest Supabase SQL.";
    }
}

async function init() {
    if (!mount || !form) return;
    if (!client) {
        status.textContent = "Login is not connected yet.";
        return;
    }

    const { data } = await client.auth.getSession();
    if (data.session) {
        await ensureProfile();
        window.location.href = destinationForEmail(data.session.user?.email);
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        if (!email) return;

        status.textContent = "Sending magic link...";
        submitButton.disabled = true;
        const slowNotice = window.setTimeout(() => {
            status.textContent = "Still waiting for Supabase. Check SMTP settings if this takes too long.";
        }, 8000);

        try {
            const result = await withTimeout(
                client.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: true,
                        emailRedirectTo: loginUrl,
                    },
                }),
                20000,
                "Supabase did not respond after 20 seconds. Check SMTP settings and Supabase Auth logs."
            );
            if (result.error) {
                status.textContent = authErrorMessage(result.error);
                return;
            }
            status.textContent = "Magic link sent. Check your inbox, spam, or junk folder, then open the link on this device.";
        } catch (error) {
            status.textContent = authErrorMessage(error);
        } finally {
            window.clearTimeout(slowNotice);
            submitButton.disabled = false;
        }
    });
}

await init();
