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

const copy = {
    signin: {
        title: "Sign in",
        text: "Use the account you signed up with.",
        submit: "Sign in",
        autocomplete: "current-password",
    },
    signup: {
        title: "Sign up",
        text: "Create one account to post, comment, and vote in the forum.",
        submit: "Create account",
        autocomplete: "new-password",
    },
};

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
        window.location.href = editorUrl;
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
        status.textContent = mode === "signup" ? "Creating account..." : "Signing in...";
        const result = mode === "signup"
            ? await client.auth.signUp({ email, password: loginPassword })
            : await client.auth.signInWithPassword({ email, password: loginPassword });
        if (result.error) {
            status.textContent = result.error.message;
            return;
        }
        if (mode === "signup" && !result.data.session) {
            status.textContent = "Account created. Check your email if Supabase asks you to confirm it, then sign in.";
            return;
        }
        window.location.href = editorUrl;
    });

    setMode("signin");
}

await init();
