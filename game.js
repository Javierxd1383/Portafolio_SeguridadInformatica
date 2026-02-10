// Cyber Runner Game Logic

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('cyberGameCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('start-game-btn');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score');
    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMsg = document.getElementById('overlay-desc');

    // Game State
    let gameRunning = false;
    let frameId;
    let score = 0;
    let gameSpeed = 5;
    let obstacles = [];
    let particles = [];
    let bgLayers = [];

    // Canvas sizing
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = 400; // Fixed height for consistency
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Game Objects
    const player = {
        x: 50,
        y: 0,
        width: 40,
        height: 40,
        dy: 0,
        jumpForce: 12,
        gravity: 0.6,
        grounded: true,
        color: '#00f3ff',

        draw() {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Cyber eye
            ctx.fillStyle = '#111';
            ctx.fillRect(this.x + 25, this.y + 10, 10, 5);

            ctx.shadowBlur = 0;
        },

        update() {
            // Jump physics
            if (keys['Space'] || keys['ArrowUp'] || keys['Touch']) {
                this.jump();
            }

            this.y += this.dy;

            const groundLevel = canvas.height - 50;

            if (this.y + this.height < groundLevel) {
                this.dy += this.gravity;
                this.grounded = false;
            } else {
                this.dy = 0;
                this.grounded = true;
                this.y = groundLevel - this.height;
            }
        },

        jump() {
            if (this.grounded) {
                this.dy = -this.jumpForce;
                this.grounded = false;
                createParticles(this.x + this.width / 2, this.y + this.height, 10, '#fff');
            }
        }
    };

    class Obstacle {
        constructor() {
            this.w = 30 + Math.random() * 30;
            this.h = 40 + Math.random() * 60;
            this.x = canvas.width;
            this.y = canvas.height - 50 - this.h;
            this.color = Math.random() > 0.5 ? '#ff0055' : '#ffcc00'; // Glitch Red or Warning Yellow
            this.passed = false;
        }

        update() {
            this.x -= gameSpeed;
        }

        draw() {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.w, this.h);

            // Glitch effect
            if (Math.random() > 0.9) {
                ctx.clearRect(this.x + Math.random() * 20, this.y + Math.random() * this.h, 10, 5);
            }
            ctx.shadowBlur = 0;
        }
    }

    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.color = color;
            this.life = 1.0;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life -= 0.02;
        }
        draw() {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    // Input Handling
    const keys = {};
    window.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
        keys[e.code] = true;
        if ((e.code === 'Space' || e.code === 'ArrowUp') && !gameRunning && overlay.style.display !== 'none') {
            startGame();
        }
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    canvas.addEventListener('touchstart', () => {
        keys['Touch'] = true;
        if (!gameRunning) startGame();
    });
    canvas.addEventListener('touchend', () => keys['Touch'] = false);
    canvas.addEventListener('mousedown', () => {
        keys['Touch'] = true;
        if (!gameRunning) startGame();
    });
    canvas.addEventListener('mouseup', () => keys['Touch'] = false);


    function createParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(x, y, color));
        }
    }

    function initBackground() {
        bgLayers = [
            { speed: 0.2, color: '#0d0d20', density: 20, items: [] }, // Far stars/buildings
            { speed: 0.5, color: '#1a1a40', density: 10, items: [] }, // Mid buildings
            { speed: 1.0, color: '#2a2a60', density: 5, items: [] }   // Near buildings
        ];

        // Populate initial layers
        bgLayers.forEach(layer => {
            for (let i = 0; i < layer.density; i++) {
                layer.items.push({
                    x: Math.random() * canvas.width,
                    y: canvas.height - 50 - (Math.random() * 100 + 50),
                    w: Math.random() * 50 + 20,
                    h: Math.random() * 150 + 50
                });
            }
        });
    }

    function drawBackground() {
        // Clear screen
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw layers
        bgLayers.forEach(layer => {
            ctx.fillStyle = layer.color;
            layer.items.forEach(item => {
                // Update position
                if (gameRunning) item.x -= layer.speed;
                // Wrap around
                if (item.x + item.w < 0) {
                    item.x = canvas.width + Math.random() * 200;
                    item.h = Math.random() * 150 + 50;
                }

                ctx.fillRect(item.x, item.y, item.w, item.h);
            });
        });

        // Draw Ground Line
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 50);
        ctx.lineTo(canvas.width, canvas.height - 50);
        ctx.stroke();

        // Grid Cyber Effect on floor
        if (gameRunning) {
            // Moving grid lines
            const offset = (Date.now() / 2) % 50;
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
            for (let i = 0; i < canvas.width; i += 50) {
                ctx.beginPath();
                ctx.moveTo(i - offset + 50, canvas.height - 50);
                ctx.lineTo(i - offset - 100, canvas.height);
                ctx.stroke();
            }
        }
    }

    function spawnObstacle() {
        if (Math.random() < 0.02) { // Spawn chance
            // Ensure minimum distance between obstacles
            if (obstacles.length === 0 || canvas.width - obstacles[obstacles.length - 1].x > 200) {
                obstacles.push(new Obstacle());
            }
        }
    }

    function resetGame() {
        score = 0;
        gameSpeed = 5;
        obstacles = [];
        particles = [];
        player.y = canvas.height - 50 - player.height;
        player.dy = 0;
        scoreEl.innerText = '0';
        gameRunning = true;
        overlay.style.display = 'none';

        // Reset local storage high score if needed
        const savedHigh = localStorage.getItem('cyber-highscore') || 0;
        highScoreEl.innerText = savedHigh;

        animate();
    }

    function gameOver() {
        gameRunning = false;
        cancelAnimationFrame(frameId);

        const currentHigh = parseInt(localStorage.getItem('cyber-highscore') || 0);
        if (score > currentHigh) {
            localStorage.setItem('cyber-highscore', score);
            highScoreEl.innerText = score;
            overlayTitle.innerHTML = "NUEVO RÉCORD <i class='fas fa-trophy'></i>";
        } else {
            overlayTitle.innerHTML = "SISTEMA COMPROMETIDO <i class='fas fa-skull-crossbones'></i>";
        }

        overlayMsg.innerText = `Puntuación Final: ${score}\nPresiona [ESPACIO] para reiniciar`;
        overlay.style.display = 'flex';
        startBtn.style.display = 'block'; // Ensure button is visible for mobile users
        startBtn.innerHTML = '<i class="fas fa-redo"></i> REINICIAR DEFENSA';
    }

    function animate() {
        if (!gameRunning) return;

        frameId = requestAnimationFrame(animate);

        drawBackground();

        player.update();
        player.draw();

        spawnObstacle();

        // Update Obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let o = obstacles[i];
            o.update();
            o.draw();

            // Collision
            if (player.x < o.x + o.w &&
                player.x + player.width > o.x &&
                player.y < o.y + o.h &&
                player.y + player.height > o.y) {
                // Boom
                createParticles(player.x, player.y, 20, '#ff0000');
                gameOver();
            }

            // Score
            if (o.x + o.w < player.x && !o.passed) {
                score++;
                scoreEl.innerText = score;
                o.passed = true;
                gameSpeed += 0.005; // Slightly increase speed
            }

            // Clean up
            if (o.x + o.w < 0) {
                obstacles.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // Initialize
    initBackground();
    drawBackground(); // Draw static background initially

    startBtn.addEventListener('click', resetGame);

    // Check local storage for high score init
    const savedHigh = localStorage.getItem('cyber-highscore') || 0;
    highScoreEl.innerText = savedHigh;
});
