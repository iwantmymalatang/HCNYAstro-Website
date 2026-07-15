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
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderList(lines) {
    return `<ul>${lines.map((line) => `<li>${inlineFormat(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
}

export function renderEditablePage(body) {
    const blocks = [];
    let list = [];

    function flushList() {
        if (list.length) {
            blocks.push(renderList(list));
            list = [];
        }
    }

    String(body || "").split(/\n{2,}/).forEach((rawBlock) => {
        const block = rawBlock.trim();
        if (!block) return;
        const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);

        if (lines.every((line) => /^[-*]\s+/.test(line))) {
            list.push(...lines);
            flushList();
            return;
        }

        flushList();
        if (/^\*[^*\n][\s\S]*[^*\n]\*$/.test(block) && !block.includes("\n")) {
            blocks.push(`<h2>${inlineFormat(block.slice(1, -1).trim())}</h2>`);
        } else if (block.startsWith("### ")) {
            blocks.push(`<h3>${inlineFormat(block.slice(4))}</h3>`);
        } else if (block.startsWith("## ")) {
            blocks.push(`<h2>${inlineFormat(block.slice(3))}</h2>`);
        } else {
            blocks.push(`<p>${inlineFormat(block).replace(/\n/g, "<br>")}</p>`);
        }
    });
    flushList();
    return blocks.join("");
}
