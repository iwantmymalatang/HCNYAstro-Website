(() => {
    const canvas = document.getElementById("orbit-canvas");
    const toggle = document.getElementById("orbit-toggle");
    if (!canvas || !toggle) return;

    const ctx = canvas.getContext("2d");
    let running = true;
    let tilt = 0.18;
    let phase = 0;
    const stars = Array.from({ length: 90 }, (_, i) => ({
        x: (i * 97) % canvas.width,
        y: (i * 53) % canvas.height,
        r: 0.6 + ((i * 11) % 8) / 8,
    }));

    function resize() {
        const box = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const cx = width / 2;
        const cy = height / 2;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#060607";
        ctx.fillRect(0, 0, width, height);

        stars.forEach((star) => {
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(phase + star.x);
            ctx.fillStyle = "#f4f4f4";
            ctx.beginPath();
            ctx.arc(star.x % width, star.y % height, star.r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        const orbitCount = 4;
        for (let i = 0; i < orbitCount; i += 1) {
            const radius = 56 + i * 42;
            ctx.strokeStyle = i === 2 ? "rgba(255, 255, 255, 0.62)" : "rgba(170, 173, 180, 0.30)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cx, cy, radius, radius * (0.46 + tilt), 0, 0, Math.PI * 2);
            ctx.stroke();

            const angle = phase * (0.55 + i * 0.12) + i * 1.35;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius * (0.46 + tilt);
            ctx.fillStyle = i === 2 ? "#ffffff" : "#b8bbc2";
            ctx.beginPath();
            ctx.arc(px, py, i === 2 ? 5 : 3.6, 0, Math.PI * 2);
            ctx.fill();
        }

        const sun = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
        sun.addColorStop(0, "#ffffff");
        sun.addColorStop(0.55, "#d7d9de");
        sun.addColorStop(1, "rgba(215, 217, 222, 0)");
        ctx.fillStyle = sun;
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.fill();

        if (running) phase += 0.018;
        requestAnimationFrame(draw);
    }

    canvas.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const y = (event.clientY - rect.top) / rect.height;
        tilt = 0.08 + y * 0.48;
    });

    toggle.addEventListener("click", () => {
        running = !running;
        toggle.textContent = running ? "Pause" : "Play";
    });

    resize();
    window.addEventListener("resize", resize);
    draw();
})();
