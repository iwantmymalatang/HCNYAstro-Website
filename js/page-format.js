export function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function inlineFormat(value) {
    return escapeHtml(value)
        .replace(/\[([^\]]+)\]\[(https?:\/\/[^\]\s]+|\/[^\]\s]+)\]/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\[([^\[\]]+)\[(https?:\/\/[^\]\s]+|\/[^\]\s]+)\]/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderList(lines) {
    return `<ul>${lines.map((line) => `<li>${inlineFormat(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
}

export function renderEditablePage(body) {
    const blocks = [];
    let list = [];
    let paragraph = [];

    function flushList() {
        if (list.length) {
            blocks.push(renderList(list));
            list = [];
        }
    }

    function flushParagraph() {
        if (paragraph.length) {
            blocks.push(`<p>${inlineFormat(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
            paragraph = [];
        }
    }

    String(body || "").replace(/\r\n/g, "\n").split("\n").forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            flushParagraph();
            flushList();
            return;
        }

        if (/^[-*]\s+/.test(line)) {
            flushParagraph();
            list.push(line);
        } else if (/^\*[^*].*[^*]\*$/.test(line)) {
            flushParagraph();
            flushList();
            blocks.push(`<h2>${inlineFormat(line.slice(1, -1).trim())}</h2>`);
        } else if (/^\*\*[^*].*[^*]\*\*$/.test(line)) {
            flushParagraph();
            flushList();
            blocks.push(`<h2>${inlineFormat(line.slice(2, -2).trim())}</h2>`);
        } else if (line.startsWith("### ")) {
            flushParagraph();
            flushList();
            blocks.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
        } else if (line.startsWith("## ")) {
            flushParagraph();
            flushList();
            blocks.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
        } else {
            flushList();
            paragraph.push(line);
        }
    });
    flushParagraph();
    flushList();
    return blocks.join("");
}
