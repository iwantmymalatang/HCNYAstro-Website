(() => {
    const canvas = typeof document === "undefined" ? null : document.getElementById("orbit-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const colors = ["#f3f1eb", "#d8b36a", "#91a098"];
    const stepSize = 0.003;
    const simulationSpeed = 0.5;
    const trailLength = 170;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let bodies;
    let trails;
    let viewScale = 1;
    let lastTime = performance.now();
    let accumulator = 0;

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function potentialEnergy(items) {
        let energy = 0;
        for (let i = 0; i < items.length; i += 1) {
            for (let j = i + 1; j < items.length; j += 1) {
                energy -= 1 / Math.hypot(items[j].x - items[i].x, items[j].y - items[i].y);
            }
        }
        return energy;
    }

    function randomSystem() {
        const phase = Math.random() * Math.PI * 2;
        const direction = Math.random() < 0.5 ? -1 : 1;
        const items = colors.map((color, index) => {
            const angle = phase + index * Math.PI * 2 / 3 + randomBetween(-0.38, 0.38);
            const radius = randomBetween(0.52, 0.9);
            const speed = randomBetween(0.48, 0.86);
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                vx: -Math.sin(angle) * speed * direction + randomBetween(-0.24, 0.24),
                vy: Math.cos(angle) * speed * direction + randomBetween(-0.24, 0.24),
                color,
            };
        });

        const center = items.reduce((sum, body) => ({
            x: sum.x + body.x / items.length,
            y: sum.y + body.y / items.length,
            vx: sum.vx + body.vx / items.length,
            vy: sum.vy + body.vy / items.length,
        }), { x: 0, y: 0, vx: 0, vy: 0 });
        items.forEach((body) => {
            body.x -= center.x;
            body.y -= center.y;
            body.vx -= center.vx;
            body.vy -= center.vy;
        });

        const kinetic = items.reduce((sum, body) => sum + (body.vx ** 2 + body.vy ** 2) / 2, 0);
        const targetKinetic = -potentialEnergy(items) * randomBetween(0.38, 0.58);
        const velocityScale = Math.sqrt(targetKinetic / kinetic);
        items.forEach((body) => {
            body.vx *= velocityScale;
            body.vy *= velocityScale;
        });
        return items;
    }

    function restart() {
        bodies = randomSystem();
        trails = bodies.map((body) => [{ x: body.x, y: body.y }]);
        accumulator = 0;
        viewScale = 0;
        lastTime = performance.now();
    }

    function accelerations(items) {
        const result = items.map(() => ({ x: 0, y: 0 }));
        for (let i = 0; i < items.length; i += 1) {
            for (let j = i + 1; j < items.length; j += 1) {
                const dx = items[j].x - items[i].x;
                const dy = items[j].y - items[i].y;
                const distanceSquared = dx * dx + dy * dy + 0.00004;
                const inverseDistanceCubed = 1 / (distanceSquared * Math.sqrt(distanceSquared));
                const ax = dx * inverseDistanceCubed;
                const ay = dy * inverseDistanceCubed;
                result[i].x += ax;
                result[i].y += ay;
                result[j].x -= ax;
                result[j].y -= ay;
            }
        }
        return result;
    }

    function integrate(items, dt) {
        const before = accelerations(items);
        items.forEach((body, index) => {
            body.vx += before[index].x * dt * 0.5;
            body.vy += before[index].y * dt * 0.5;
            body.x += body.vx * dt;
            body.y += body.vy * dt;
        });
        const after = accelerations(items);
        items.forEach((body, index) => {
            body.vx += after[index].x * dt * 0.5;
            body.vy += after[index].y * dt * 0.5;
        });
    }

    function extent(items) {
        return Math.max(...items.map((body) => Math.hypot(body.x, body.y)));
    }

    function isUsable(items) {
        return items.every((body) => Number.isFinite(body.x) && Number.isFinite(body.y))
            && extent(items) < 5;
    }

    function resize() {
        const box = canvas.getBoundingClientRect();
        const dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    function screenPoint(point, width, height) {
        return {
            x: width / 2 + point.x * viewScale,
            y: height / 2 - point.y * viewScale,
        };
    }

    function drawBody(point, color) {
        const glow = ctx.createRadialGradient(point.x, point.y, 1, point.x, point.y, 23);
        glow.addColorStop(0, color);
        glow.addColorStop(0.2, color);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 23, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5.25, 0, Math.PI * 2);
        ctx.fill();
    }

    function draw() {
        if (!bodies) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const targetScale = Math.min(width, height) * 0.38 / Math.max(extent(bodies), 0.68);
        viewScale = !viewScale || targetScale < viewScale
            ? targetScale
            : viewScale + (targetScale - viewScale) * 0.055;
        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "rgba(243, 241, 235, 0.15)";
        for (let i = 0; i < 15; i += 1) {
            ctx.fillRect((i * 83 + 29) % width, (i * 47 + 17) % height, 1, 1);
        }

        trails.forEach((trail, bodyIndex) => {
            ctx.strokeStyle = bodies[bodyIndex].color;
            ctx.lineWidth = 1.1;
            for (let i = 1; i < trail.length; i += 1) {
                const from = screenPoint(trail[i - 1], width, height);
                const to = screenPoint(trail[i], width, height);
                ctx.globalAlpha = (i / trail.length) * 0.44;
                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
        bodies.forEach((body) => drawBody(screenPoint(body, width, height), body.color));
    }

    function frame(now) {
        accumulator += Math.min((now - lastTime) / 1000, 0.04) * simulationSpeed;
        while (accumulator >= stepSize) {
            integrate(bodies, stepSize);
            accumulator -= stepSize;
        }
        if (!isUsable(bodies)) restart();
        bodies.forEach((body, index) => {
            trails[index].push({ x: body.x, y: body.y });
            if (trails[index].length > trailLength) trails[index].shift();
        });
        lastTime = now;
        draw();
        requestAnimationFrame(frame);
    }

    const check = randomSystem();
    console.assert(potentialEnergy(check) + check.reduce((sum, body) =>
        sum + (body.vx ** 2 + body.vy ** 2) / 2, 0) < 0, "Random three-body system must begin gravitationally bound.");

    canvas.dataset.simulation = "randomized-newtonian";
    canvas.dataset.integrator = "leapfrog";
    restart();
    if (reducedMotion) {
        for (let i = 0; i < 700; i += 1) integrate(bodies, stepSize);
    }
    resize();
    new ResizeObserver(resize).observe(canvas);
    if (!reducedMotion) requestAnimationFrame(frame);
})();
