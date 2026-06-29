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
    const imageFileInput = document.getElementById("post-image-file");
    const imageNameInput = document.getElementById("post-image-name");
    const imageAltInput = document.getElementById("post-image-alt");
    const imageMarkdownOutput = document.getElementById("image-markdown");
    const imagePreviewWrap = document.getElementById("image-preview-wrap");
    const imagePreview = document.getElementById("image-preview");
    const insertImageButton = document.getElementById("insert-image-markdown");
    const copyImageButton = document.getElementById("copy-image-markdown");
    const downloadImageButton = document.getElementById("download-image-file");
    const copyButton = document.getElementById("copy-markdown");
    const downloadButton = document.getElementById("download-markdown");
    const githubLink = document.getElementById("open-github-post");
    const status = document.getElementById("builder-status");
    let selectedImage = null;

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

    function safeImageName(name, fallbackTitle) {
        const parts = name.split(".");
        const extension = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg";
        const base = parts.join(".") || fallbackTitle || "post-image";
        const safeBase = slugify(base);
        return `${safeBase}.${extension || "jpg"}`;
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
        updateImageMarkdown();
    }

    function getImageMarkdown() {
        const filename = imageNameInput.value.trim() || safeImageName("image.jpg", titleInput.value);
        const alt = imageAltInput.value.trim() || titleInput.value.trim() || "Post image";
        return `![${alt}](/HCNYAstro-Website/images/posts/${filename})`;
    }

    function updateImageMarkdown() {
        if (!imageNameInput.value.trim()) {
            imageNameInput.value = safeImageName("image.jpg", titleInput.value);
        }
        imageMarkdownOutput.textContent = getImageMarkdown();
        downloadImageButton.disabled = !selectedImage;
        downloadImageButton.dataset.filename = imageNameInput.value.trim();
    }

    function insertAtCursor(textarea, text) {
        const start = textarea.selectionStart || textarea.value.length;
        const end = textarea.selectionEnd || textarea.value.length;
        const before = textarea.value.slice(0, start).replace(/\s*$/, "\n\n");
        const after = textarea.value.slice(end).replace(/^\s*/, "\n\n");
        textarea.value = `${before}${text}${after}`;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = before.length + text.length;
        buildMarkdown();
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

    async function copyImageMarkdown() {
        await navigator.clipboard.writeText(getImageMarkdown());
        status.textContent = "Image Markdown copied.";
    }

    function downloadImageFile() {
        if (!selectedImage) {
            status.textContent = "Choose an image first.";
            return;
        }

        const url = URL.createObjectURL(selectedImage);
        const link = document.createElement("a");
        link.href = url;
        link.download = imageNameInput.value.trim() || selectedImage.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        status.textContent = "Renamed image downloaded.";
    }

    [titleInput, dateInput, authorInput, summaryInput, bodyInput].forEach((input) => {
        input.addEventListener("input", buildMarkdown);
    });

    [imageNameInput, imageAltInput].forEach((input) => {
        input.addEventListener("input", updateImageMarkdown);
    });

    imageFileInput.addEventListener("change", () => {
        selectedImage = imageFileInput.files && imageFileInput.files[0] ? imageFileInput.files[0] : null;
        if (!selectedImage) {
            imagePreviewWrap.hidden = true;
            updateImageMarkdown();
            return;
        }

        imageNameInput.value = safeImageName(selectedImage.name, titleInput.value);
        if (!imageAltInput.value.trim()) imageAltInput.value = titleInput.value.trim() || "Post image";
        imagePreview.src = URL.createObjectURL(selectedImage);
        imagePreview.alt = imageAltInput.value.trim();
        imagePreviewWrap.hidden = false;
        updateImageMarkdown();
    });

    copyButton.addEventListener("click", copyMarkdown);
    downloadButton.addEventListener("click", downloadMarkdown);
    copyImageButton.addEventListener("click", copyImageMarkdown);
    downloadImageButton.addEventListener("click", downloadImageFile);
    insertImageButton.addEventListener("click", () => {
        insertAtCursor(bodyInput, getImageMarkdown());
        status.textContent = "Image Markdown inserted.";
    });
    dateInput.value = todayInSingapore();
    authorInput.value = "HCNY Astronomy";
    buildMarkdown();
})();
