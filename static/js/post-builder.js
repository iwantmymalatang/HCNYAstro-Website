(() => {
    const builder = document.querySelector(".admin-builder");
    if (!builder) return;

    const repo = builder.dataset.repo || "";
    const titleInput = document.getElementById("post-title");
    const dateInput = document.getElementById("post-date");
    const authorInput = document.getElementById("post-author");
    const summaryInput = document.getElementById("post-summary");
    const bodyInput = document.getElementById("post-body");
    const filenameOutput = document.getElementById("post-filename");
    const markdownOutput = document.getElementById("post-markdown");
    const copyButton = document.getElementById("copy-markdown");
    const downloadButton = document.getElementById("download-markdown");
    const githubLink = document.getElementById("open-github-post");
    const status = document.getElementById("builder-status");

    function todayInSingapore() {
        const formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Singapore",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        return formatter.format(new Date());
    }

    function slugify(value) {
        return value
            .toLowerCase()
            .trim()
            .replace(/['"]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 72) || "new-post";
    }

    function escapeToml(value) {
        return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    function buildMarkdown() {
        const title = titleInput.value.trim() || "New post";
        const date = dateInput.value || todayInSingapore();
        const author = authorInput.value.trim();
        const summary = summaryInput.value.trim();
        const body = bodyInput.value.trim() || "Write your post here.";
        const slug = slugify(title);
        const filename = `${slug}.md`;
        const lines = [
            "+++",
            `title = "${escapeToml(title)}"`,
            `date = ${date}T00:00:00+08:00`,
            "draft = false",
        ];

        if (author) lines.push(`author = "${escapeToml(author)}"`);
        if (summary) lines.push(`summary = "${escapeToml(summary)}"`);

        lines.push("+++", "", body, "");

        filenameOutput.textContent = `content/posts/${filename}`;
        markdownOutput.value = lines.join("\n");
        githubLink.href = `${repo}/new/main/content/posts?filename=${encodeURIComponent(filename)}`;
        downloadButton.dataset.filename = filename;
    }

    async function copyMarkdown() {
        markdownOutput.select();
        markdownOutput.setSelectionRange(0, markdownOutput.value.length);

        try {
            await navigator.clipboard.writeText(markdownOutput.value);
            status.textContent = "Copied. Paste it into the GitHub file editor, then commit.";
        } catch {
            document.execCommand("copy");
            status.textContent = "Copied. Paste it into the GitHub file editor, then commit.";
        }
    }

    function downloadMarkdown() {
        const blob = new Blob([markdownOutput.value], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadButton.dataset.filename || "new-post.md";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        status.textContent = "Downloaded.";
    }

    [titleInput, dateInput, authorInput, summaryInput, bodyInput].forEach((input) => {
        input.addEventListener("input", buildMarkdown);
    });

    copyButton.addEventListener("click", copyMarkdown);
    downloadButton.addEventListener("click", downloadMarkdown);
    dateInput.value = todayInSingapore();
    authorInput.value = "HCNY Astronomy";
    buildMarkdown();
})();
