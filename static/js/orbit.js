(() => {
    const canvas = document.getElementById("orbit-canvas");
    const toggle = document.getElementById("orbit-toggle");
    if (!canvas || !toggle) return;

    const ctx = canvas.getContext("2d");
    let running = true;
    let phase = 0;
    let tilt = 0.58;

    const facts = [
        "Alpha Centauri A: Sun-like G-type star",
        "Alpha Centauri B: cooler K-type companion",
        "Proxima Centauri: faint red dwarf, nearest star to the Sun",
        "AB orbit: about 80 years; Proxima distance is compressed here",
    ];

    function resize() {
        const box = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function text(label, x, y, color = "#c9c7ff") {
        ctx.fillStyle = color;
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.fillText(label, x, y);
    }

    function glow(x, y, radius, core, halo) {
        const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
        gradient.addColorStop(0, core);
        gradient.addColorStop(0.42, core);
        gradient.addColorStop(1, halo);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function draw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const cx = width * 0.47;
        const cy = height * 0.49;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#04050c";
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < 54; i += 1) {
            const x = (i * 89 + 31) % width;
            const y = (i * 47 + 19) % height;
            const alpha = 0.24 + 0.26 * Math.sin(phase * 0.7 + i);
            ctx.fillStyle = `rgba(218, 219, 255, ${alpha})`;
            ctx.fillRect(x, y, 1, 1);
        }

        const abRadius = Math.min(width, height) * 0.18;
        ctx.strokeStyle = "rgba(143, 140, 255, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, abRadius, abRadius * tilt, 0, 0, Math.PI * 2);
        ctx.stroke();

        const angle = phase;
        const ax = cx + Math.cos(angle) * abRadius * 0.52;
        const ay = cy + Math.sin(angle) * abRadius * tilt * 0.52;
        const bx = cx - Math.cos(angle) * abRadius * 0.48;
        const by = cy - Math.sin(angle) * abRadius * tilt * 0.48;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        glow(ax, ay, 22, "#ffffff", "rgba(143, 140, 255, 0)");
        glow(bx, by, 17, "#d8d2ff", "rgba(98, 76, 180, 0)");

        text("A", ax + 15, ay - 14, "#ffffff");
        text("B", bx + 13, by - 12, "#d8d2ff");

        const proximaAngle = -0.8 + Math.sin(phase * 0.18) * 0.12;
        const proximaRadius = Math.min(width, height) * 0.43;
        const px = cx + Math.cos(proximaAngle) * proximaRadius;
        const py = cy + Math.sin(proximaAngle) * proximaRadius * 0.72;

        ctx.strokeStyle = "rgba(112, 92, 210, 0.24)";
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, proximaRadius, proximaRadius * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        glow(px, py, 10, "#a58bff", "rgba(165, 139, 255, 0)");
        text("Proxima", px + 12, py + 4, "#a58bff");

        ctx.fillStyle = "rgba(11, 13, 24, 0.72)";
        ctx.fillRect(16, height - 98, Math.min(390, width - 32), 76);
        facts.forEach((fact, i) => text(fact, 28, height - 74 + i * 17, i === 3 ? "#8f93ad" : "#d8d9ff"));

        if (running) phase += 0.015;
        requestAnimationFrame(draw);
    }

    canvas.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const y = (event.clientY - rect.top) / rect.height;
        tilt = 0.38 + y * 0.36;
    });

    toggle.addEventListener("click", () => {
        running = !running;
        toggle.textContent = running ? "Pause" : "Play";
    });

    resize();
    window.addEventListener("resize", resize);
    draw();
})();
