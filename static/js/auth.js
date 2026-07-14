import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const mount = document.getElementById("dynamic-login");
const client = mount?.dataset.supabaseUrl && mount?.dataset.supabaseKey
    ? createClient(mount.dataset.supabaseUrl, mount.dataset.supabaseKey)
    : null;

const form = document.getElementById("dynamic-login-form");
const status = document.getElementById("login-status");
const modeInput = document.getElementById("auth-mode");
const modeCopy = document.getElementById("auth-mode-copy");
const submitButton = document.getElementById("login-submit-button");
const password = document.getElementById("login-password");
const editorUrl = mount?.dataset.editorUrl || "../forum/";
const adminUrl = mount?.dataset.adminUrl || "../admin-dashboard/";

const copy = {
    signin: {
        title: "Sign in",
        text: "Use the account you signed up with.",
        submit: "Sign in",
        autocomplete: "current-password",
    },
    signup: {
        title: "Sign up",
        text: "Create one account to post, comment, and vote. Use a unique password. If email confirmation is enabled, check your inbox after signing up.",
        submit: "Create account",
        autocomplete: "new-password",
    },
};

function passwordIssue(value) {
    if (value.length < 10) return "Use at least 10 characters.";
    if (!/[a-z]/.test(value)) return "Add a lowercase letter.";
    if (!/[A-Z]/.test(value)) return "Add an uppercase letter.";
    if (!/[0-9]/.test(value)) return "Add a number.";
    if (!/[^A-Za-z0-9]/.test(value)) return "Add a symbol.";
    if (/password|qwerty|123456|hcny|astro/i.test(value)) return "Avoid common or site-related words.";
    return "";
}

function authErrorMessage(error) {
    const message = error?.message || String(error || "");
    const lower = message.toLowerCase();
    if (lower.includes("rate") && lower.includes("email")) {
        return "Supabase email limit reached. Try again later, or ask the admin to enable custom SMTP in Supabase Authentication settings.";
    }
    if (lower.includes("email rate limit")) {
        return "Supabase email limit reached. Try again later, or ask the admin to enable custom SMTP in Supabase Authentication settings.";
    }
    if (lower.includes("smtp") || lower.includes("email provider") || lower.includes("failed to send")) {
        return "Supabase could not send the email. Check custom SMTP settings: host, port 587, username, app password, sender address, and sender name.";
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

function setMode(mode) {
    const detail = copy[mode] || copy.signin;
    modeInput.value = mode;
    modeCopy.innerHTML = `<strong>${detail.title}</strong><p>${detail.text}</p>`;
    submitButton.textContent = detail.submit;
    password.autocomplete = detail.autocomplete;
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.authMode === mode);
    });
    status.textContent = "";
}

async function init() {
    if (!mount || !form) return;
    if (!client) {
        status.textContent = "Login is not connected yet.";
        return;
    }

    const { data } = await client.auth.getSession();
    if (data.session) {
        window.location.href = destinationForEmail(data.session.user?.email);
        return;
    }

    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => setMode(button.dataset.authMode));
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const mode = modeInput.value || "signin";
        const email = document.getElementById("login-email").value.trim();
        const loginPassword = password.value;
        if (mode === "signup") {
            const issue = passwordIssue(loginPassword);
            if (issue) {
                status.textContent = `Weak password: ${issue}`;
                return;
            }
        }
        status.textContent = mode === "signup" ? "Creating account..." : "Signing in...";
        submitButton.disabled = true;
        let result;
        try {
            result = await withTimeout(
                mode === "signup"
                    ? client.auth.signUp({ email, password: loginPassword })
                    : client.auth.signInWithPassword({ email, password: loginPassword }),
                20000,
                "Supabase did not respond after 20 seconds. If you just enabled custom SMTP, check the SMTP host, port, username, password, sender address, and Supabase Auth logs."
            );
        } catch (error) {
            status.textContent = authErrorMessage(error);
            submitButton.disabled = false;
            return;
        }
        submitButton.disabled = false;
        if (result.error) {
            status.textContent = authErrorMessage(result.error);
            return;
        }
        if (mode === "signup" && !result.data.user?.email_confirmed_at) {
            if (result.data.session) await client.auth.signOut();
            status.textContent = "Account created. Confirm your email, then come back and sign in.";
            return;
        }
        window.location.href = destinationForEmail(result.data.user?.email || email);
    });

    setMode("signin");
}

await init();
