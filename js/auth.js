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
const confirmPasswordRow = document.getElementById("confirm-password-row");
const confirmPassword = document.getElementById("confirm-password");
const togglePassword = document.getElementById("toggle-password");
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
        text: "Create one account to post, comment, and vote. If email confirmation is enabled, check your inbox after signing up.",
        submit: "Create account",
        autocomplete: "new-password",
    },
};

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
    confirmPasswordRow.hidden = mode !== "signup";
    confirmPassword.required = mode === "signup";
    confirmPassword.value = "";
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
        if (mode === "signup" && loginPassword !== confirmPassword.value) {
            status.textContent = "Passwords do not match.";
            return;
        }
        status.textContent = mode === "signup" ? "Creating account..." : "Signing in...";
        submitButton.disabled = true;
        const slowNotice = window.setTimeout(() => {
            if (mode === "signup") {
                status.textContent = "Still waiting for Supabase. This usually means the confirmation email or custom SMTP settings are stuck.";
            }
        }, 8000);
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
            window.clearTimeout(slowNotice);
            status.textContent = authErrorMessage(error);
            submitButton.disabled = false;
            return;
        }
        window.clearTimeout(slowNotice);
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
    togglePassword.addEventListener("click", () => {
        const nextType = password.type === "password" ? "text" : "password";
        password.type = nextType;
        confirmPassword.type = nextType;
        togglePassword.textContent = nextType === "password" ? "Show" : "Hide";
    });
}

await init();
