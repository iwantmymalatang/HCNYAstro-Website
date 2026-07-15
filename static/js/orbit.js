(() => {
    const canvas = document.getElementById("orbit-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let phase = 0;
    let scaleTilt = 1;

    function resize() {
        const box = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function lemniscate(t, radius) {
        const s = Math.sin(t);
        const c = Math.cos(t);
        const denom = 1 + s * s;
        return {
            x: (radius * c) / denom,
            y: (radius * s * c) / denom,
        };
    }

    function drawBody(x, y, radius, color, label) {
        const glow = ctx.createRadialGradient(x, y, 1, x, y, radius * 4.5);
        glow.addColorStop(0, color);
        glow.addColorStop(0.34, color);
        glow.addColorStop(1, "rgba(120, 90, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#d7d2c8";
        ctx.font = '12px "Avenir Next", sans-serif';
        ctx.fillText(label, x + 12, y - 10);
    }

    function draw() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.44;

        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < 64; i += 1) {
            const x = (i * 73 + 11) % width;
            const y = (i * 41 + 29) % height;
            ctx.fillStyle = `rgba(224, 216, 198, ${0.12 + 0.14 * Math.sin(phase + i)})`;
            ctx.fillRect(x, y, 1, 1);
        }

        ctx.strokeStyle = "rgba(212, 168, 95, 0.34)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= 360; i += 1) {
            const point = lemniscate((i / 360) * Math.PI * 2, radius);
            const x = cx + point.x;
            const y = cy + point.y * scaleTilt;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        const bodies = [
            { offset: 0, color: "#ffffff", label: "m1" },
            { offset: (Math.PI * 2) / 3, color: "#d4a85f", label: "m2" },
            { offset: (Math.PI * 4) / 3, color: "#9ca9a2", label: "m3" },
        ];

        bodies.forEach((body) => {
            const p = lemniscate(phase + body.offset, radius);
            drawBody(cx + p.x, cy + p.y * scaleTilt, 5.5, body.color, body.label);
        });

        phase += 0.012;
        requestAnimationFrame(draw);
    }

    canvas.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const y = (event.clientY - rect.top) / rect.height;
        scaleTilt = 0.55 + y * 0.7;
    });

    resize();
    window.addEventListener("resize", resize);
    draw();
})();
