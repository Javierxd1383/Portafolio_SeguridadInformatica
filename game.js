// Cyber Bomber Game Logic - Enhanced v2

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('cyberGameCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('start-game-btn');
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    const highScoreEl = document.getElementById('high-score');
    const overlay = document.getElementById('game-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMsg = document.getElementById('overlay-desc');

    // Constants
    const TILE_SIZE = 40;
    const GRID_COLS = 15;
    const GRID_ROWS = 13;
    const CANVAS_WIDTH = GRID_COLS * TILE_SIZE;
    const CANVAS_HEIGHT = GRID_ROWS * TILE_SIZE;

    // Game Colors
    const COLORS = {
        bg: '#050510',
        wallHard: '#1a1a40',
        wallHardStroke: '#00ccff',
        wallSoft: '#ff0055',
        wallSoftStroke: '#ff99aa',
        floor: '#0b0b1a',
        player: '#00f3ff',
        bomb: '#ffcc00',
        explosion: '#ff3300',
        enemy: '#ff2222'
    };

    // Game State
    let gameRunning = false;
    let frameId;
    let score = 0;
    let level = 1;
    let timeLeft = 180; // 3 minutes
    let fireUpsSpawned = 0;
    let grid = []; // 0: Floor, 1: Hard Wall, 2: Soft Wall, 3: Bomb, 4: Explosion
    let entities = [];
    let bombs = [];
    let explosions = [];
    let enemies = [];
    let powerups = [];
    let player = null;
    let particles = [];
    let globalTime = 0;

    // Input Handling
    const keys = {};
    window.addEventListener('keydown', e => {
        if (!gameRunning) return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
        keys[e.code] = true;

        if (e.code === 'Space' && player && !player.dead) {
            player.placeBomb();
        }
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    // Initial Setup
    function initCanvas() {
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
    }
    initCanvas();

    // --- Visual Helpers ---
    function drawNeonRect(x, y, w, h, color, glow = true) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (glow) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
        }
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }

    // --- Classes ---

    class Player {
        constructor() {
            this.gridX = 1;
            this.gridY = 1;
            this.x = this.gridX * TILE_SIZE;
            this.y = this.gridY * TILE_SIZE;
            this.width = TILE_SIZE - 4;
            this.height = TILE_SIZE - 4;
            this.speed = 2.4; // Slower, more controlled
            this.dead = false;
            this.maxBombs = 1;
            this.activeBombs = 0;
            this.powerRange = 2;
            this.animFrame = 0;
            this.direction = 'down'; // down, up, left, right
        }

        update() {
            if (this.dead) return;

            let dx = 0;
            let dy = 0;
            let moving = false;

            if (keys['ArrowUp']) { dy = -this.speed; this.direction = 'up'; moving = true; }
            else if (keys['ArrowDown']) { dy = this.speed; this.direction = 'down'; moving = true; }
            else if (keys['ArrowLeft']) { dx = -this.speed; this.direction = 'left'; moving = true; }
            else if (keys['ArrowRight']) { dx = this.speed; this.direction = 'right'; moving = true; }

            if (moving) this.animFrame += 0.2;

            // X Movement
            if (dx !== 0) {
                const newX = this.x + dx;
                if (!this.checkCollision(newX, this.y)) {
                    this.x = newX;
                } else {
                    // Smooth slide around corners
                    const centerY = this.gridY * TILE_SIZE + (TILE_SIZE - this.height) / 2;
                    const diff = this.y - centerY; // Relative to "ideal" center
                    // If we are close enough to the lane, snap us
                    if (Math.abs(diff) < 12 && Math.abs(diff) > 0) {
                        if (diff > 0) this.y -= 2;
                        else this.y += 2;
                    }
                }
            }

            // Y Movement
            if (dy !== 0) {
                const newY = this.y + dy;
                if (!this.checkCollision(this.x, newY)) {
                    this.y = newY;
                } else {
                    // Smooth slide around corners
                    const centerX = this.gridX * TILE_SIZE + (TILE_SIZE - this.width) / 2;
                    const diff = this.x - centerX;
                    if (Math.abs(diff) < 12 && Math.abs(diff) > 0) {
                        if (diff > 0) this.x -= 2;
                        else this.x += 2;
                    }
                }
            }

            // Update Grid Coords (Center of sprite)
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            this.gridX = Math.floor(cx / TILE_SIZE);
            this.gridY = Math.floor(cy / TILE_SIZE);

            // Check Interactions
            enemies.forEach(enemy => {
                const dist = Math.hypot((enemy.x - this.x), (enemy.y - this.y));
                if (dist < TILE_SIZE * 0.7) this.die();
            });

            explosions.forEach(exp => {
                if (exp.gridX === this.gridX && exp.gridY === this.gridY) this.die();
            });
        }

        checkCollision(nx, ny) {
            // Helper to see if a box intersects a wall
            // Player box is smaller than tile
            const margin = 6;
            const testResult = (x, y) => {
                const gx = Math.floor(x / TILE_SIZE);
                const gy = Math.floor(y / TILE_SIZE);
                if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return true; // Bounds

                const tile = grid[gy][gx];
                if (tile === 0 || tile === 4) return false; // Walkable (Floor or Explosion)

                if (tile === 3) {
                    // BOMB LOGIC FIX:
                    // If the player bounds *currently* overlap this bomb tile, we allow movement.
                    // This means we are "inside" the bomb and walking out.
                    const myGx1 = Math.floor((this.x + margin) / TILE_SIZE);
                    const myGy1 = Math.floor((this.y + margin) / TILE_SIZE);
                    const myGx2 = Math.floor((this.x + this.width - margin) / TILE_SIZE);
                    const myGy2 = Math.floor((this.y + this.height - margin) / TILE_SIZE);

                    // Do any of my current corners match the bomb tile?
                    if ((myGx1 === gx && myGy1 === gy) || (myGx2 === gx && myGy1 === gy) ||
                        (myGx1 === gx && myGy2 === gy) || (myGx2 === gx && myGy2 === gy)) {
                        return false; // Allow movement if we are currently touching it
                    }
                    return true; // Else it's solid
                }
                return true; // Wall
            };

            // Test 4 corners of new position
            // Add offset to center sprite in 40x40 tile (sprite is ~36x36)
            const ox = (TILE_SIZE - this.width) / 2;
            const oy = (TILE_SIZE - this.height) / 2;

            // Adjust nx/ny to represent the visual sprite top-left relative to grid?
            // Actually nx,ny are the top-left of the bounding box.
            // Let's assume nx,ny passed in ARE the top-left.

            // Tight collision box
            if (testResult(nx + margin, ny + margin)) return true;
            if (testResult(nx + this.width - margin, ny + margin)) return true;
            if (testResult(nx + margin, ny + this.height - margin)) return true;
            if (testResult(nx + this.width - margin, ny + this.height - margin)) return true;

            return false;
        }

        placeBomb() {
            // Center bomb on the tile center closest to player center
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const gx = Math.floor(cx / TILE_SIZE);
            const gy = Math.floor(cy / TILE_SIZE);

            if (this.activeBombs < this.maxBombs && grid[gy][gx] === 0) {
                const bomb = new Bomb(gx, gy, this.powerRange, this);
                bombs.push(bomb);
                grid[gy][gx] = 3;
                this.activeBombs++;
            }
        }

        die() {
            if (this.dead) return;
            this.dead = true;
            createExplosionParticles(this.x + TILE_SIZE / 2, this.y + TILE_SIZE / 2, COLORS.player);
            setTimeout(gameOver, 1000);
        }

        draw() {
            if (this.dead) return;

            const cx = this.x + this.width / 2 + 2; // +2 for offset centering
            const cy = this.y + this.height / 2 + 2;

            // Character Polish: Cyber Ninja
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS.player;
            ctx.fillStyle = COLORS.player;

            // Bobbing animation
            const bob = Math.sin(this.animFrame) * 2;

            // Body
            ctx.beginPath();
            ctx.ellipse(cx, cy + 5 + bob, 10, 12, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.arc(cx, cy - 8 + bob, 9, 0, Math.PI * 2);
            ctx.fill();

            // Visor (Glowing Eye)
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;
            ctx.fillRect(cx - 6, cy - 10 + bob, 12, 4);

            // Scarf/Trail
            ctx.strokeStyle = '#0077aa';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 5 + bob);
            ctx.quadraticCurveTo(cx - 15, cy + bob, cx - 12 - (Math.sin(globalTime * 0.2) * 5), cy + 10 + bob);
            ctx.stroke();

            ctx.restore();
        }
    }

    class Bomb {
        constructor(gx, gy, range, owner) {
            this.gridX = gx;
            this.gridY = gy;
            this.range = range;
            this.owner = owner;
            this.timer = 180;
            this.pulse = 0;
        }

        update() {
            this.timer--;
            this.pulse += 0.15;
            if (this.timer <= 0) {
                this.explode();
            }
        }

        explode() {
            this.owner.activeBombs--;
            bombs = bombs.filter(b => b !== this);
            grid[this.gridY][this.gridX] = 0;
            this.createExplosionFragment(this.gridX, this.gridY);

            const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

            dirs.forEach(d => {
                for (let i = 1; i <= this.range; i++) {
                    const tx = this.gridX + (d.x * i);
                    const ty = this.gridY + (d.y * i);
                    if (tx < 0 || tx >= GRID_COLS || ty < 0 || ty >= GRID_ROWS) break;

                    const tile = grid[ty][tx];
                    if (tile === 1) break;

                    this.createExplosionFragment(tx, ty);

                    if (tile === 2) {
                        grid[ty][tx] = 0;
                        score += 10;
                        scoreEl.innerText = score;
                        createExplosionParticles(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2, COLORS.wallSoft);

                        // Spawn PowerUp chance
                        if (Math.random() < 0.4) {
                            powerups.push(new PowerUp(tx, ty, Math.random() > 0.5 ? 'bomb' : 'fire'));
                        }

                        break;
                    }
                    if (tile === 3) {
                        const chainBomb = bombs.find(b => b.gridX === tx && b.gridY === ty);
                        if (chainBomb) chainBomb.timer = 0;
                    }
                }
            });
        }

        createExplosionFragment(gx, gy) {
            explosions.push(new Explosion(gx, gy));
        }

        draw() {
            const x = this.gridX * TILE_SIZE;
            const y = this.gridY * TILE_SIZE;
            const cx = x + TILE_SIZE / 2;
            const cy = y + TILE_SIZE / 2;

            // Design: Cyber Mine v2
            const pulse = (Math.sin(this.pulse * 2) + 1) / 2;

            ctx.save();
            ctx.translate(cx, cy);

            // Rotating Outer Ring
            ctx.rotate(this.pulse);
            ctx.strokeStyle = COLORS.bomb;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.stroke();

            // Crosshairs
            ctx.beginPath();
            ctx.moveTo(-16, 0); ctx.lineTo(16, 0);
            ctx.moveTo(0, -16); ctx.lineTo(0, 16);
            ctx.stroke();

            // Inner Core (Pulsing Warning)
            ctx.rotate(-this.pulse * 2);
            ctx.fillStyle = pulse > 0.5 ? '#ff0000' : '#440000';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 10 + pulse * 10;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            // Digital Countdown feel
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -2, 4, 4);

            ctx.restore();
        }
    }

    class Explosion {
        constructor(gx, gy) {
            this.gridX = gx;
            this.gridY = gy;
            this.life = 20;
        }
        update() { this.life--; }
        draw() {
            const cx = this.gridX * TILE_SIZE + TILE_SIZE / 2;
            const cy = this.gridY * TILE_SIZE + TILE_SIZE / 2;
            const alpha = this.life / 20;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(cx, cy);

            ctx.fillStyle = COLORS.explosion;
            ctx.shadowColor = COLORS.explosion;
            ctx.shadowBlur = 15;

            // Plasma Blast
            const s = TILE_SIZE;
            // Central chaotic shape
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                const r = (s / 2) * (0.5 + Math.random() * 0.5);
                ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.fill();

            // Electric Sparks
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s / 2, s / 2);
            ctx.moveTo(s / 2, -s / 2); ctx.lineTo(-s / 2, s / 2);
            ctx.stroke();

            ctx.restore();
        }
    }

    // --- PowerUp Class ---
    class PowerUp {
        constructor(gx, gy, type) {
            this.gridX = gx;
            this.gridY = gy;
            this.type = type; // 'bomb' or 'fire'
            this.animOffset = Math.random() * 100;
        }

        draw() {
            const cx = this.gridX * TILE_SIZE + TILE_SIZE / 2;
            const cy = this.gridY * TILE_SIZE + TILE_SIZE / 2;
            const bob = Math.sin(globalTime * 0.2 + this.animOffset) * 3;

            ctx.save();
            ctx.translate(cx, cy + bob);

            // Base Glow
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#fff';

            if (this.type === 'bomb') {
                ctx.shadowColor = COLORS.bomb;
                // Bomb Icon
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.fillStyle = COLORS.bomb;
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+1', 0, 0);
            } else if (this.type === 'fire') {
                ctx.shadowColor = COLORS.explosion;
                // Fire Icon
                ctx.fillStyle = COLORS.explosion;
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(6, 4);
                ctx.lineTo(-6, 4);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.fillRect(-2, 0, 4, 4);
            }

            ctx.restore();
        }
    }

    class Enemy {
        constructor(gx, gy) {
            this.x = gx * TILE_SIZE;
            this.y = gy * TILE_SIZE;
            this.speed = 1.2;
            this.dir = Math.floor(Math.random() * 4);
            this.animOffset = Math.random() * 100;
        }

        update() {
            const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
            const move = dirs[this.dir];
            const nextX = this.x + (move.x * this.speed);
            const nextY = this.y + (move.y * this.speed);

            // Rect collision against walls/bombs
            // Basic logic: checks center point + margin
            const canMove = (nx, ny) => {
                const gx = Math.floor((nx + TILE_SIZE / 2) / TILE_SIZE);
                const gy = Math.floor((ny + TILE_SIZE / 2) / TILE_SIZE);
                if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return false;
                const t = grid[gy][gx];
                return t === 0 || t === 4; // Enemy CANNOT walk on bomb
            };

            // Check corners for strict wall observance
            const margin = 2;
            const cornersClear = (nx, ny) => {
                // Check 4 corners
                const pts = [
                    { x: nx + margin, y: ny + margin }, { x: nx + TILE_SIZE - margin, y: ny + margin },
                    { x: nx + margin, y: ny + TILE_SIZE - margin }, { x: nx + TILE_SIZE - margin, y: ny + TILE_SIZE - margin }
                ];
                return pts.every(p => {
                    const gx = Math.floor(p.x / TILE_SIZE);
                    const gy = Math.floor(p.y / TILE_SIZE);
                    // Bounds
                    if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return false;
                    const val = grid[gy][gx];
                    return val !== 1 && val !== 2 && val !== 3;
                });
            };

            if (cornersClear(nextX, nextY)) {
                this.x = nextX;
                this.y = nextY;
            } else {
                this.x = Math.round(this.x / TILE_SIZE) * TILE_SIZE;
                this.y = Math.round(this.y / TILE_SIZE) * TILE_SIZE;
                this.dir = Math.floor(Math.random() * 4);
            }
            if (Math.random() < 0.01) {
                this.x = Math.round(this.x / TILE_SIZE) * TILE_SIZE;
                this.y = Math.round(this.y / TILE_SIZE) * TILE_SIZE;
                this.dir = Math.floor(Math.random() * 4);
            }

            const centerGx = Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE);
            const centerGy = Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE);
            explosions.forEach(exp => {
                if (exp.gridX === centerGx && exp.gridY === centerGy) this.die();
            });
        }

        die() {
            score += 100;
            scoreEl.innerText = score;
            createExplosionParticles(this.x + TILE_SIZE / 2, this.y + TILE_SIZE / 2, COLORS.enemy);
            enemies = enemies.filter(e => e !== this);
            if (enemies.length === 0) setTimeout(gameWin, 1000);
        }

        draw() {
            const cx = this.x + TILE_SIZE / 2;
            const cy = this.y + TILE_SIZE / 2;

            // Design: Virus/Bug
            ctx.save();
            ctx.translate(cx, cy);

            // Jitter/Rotate
            const jitter = Math.sin(globalTime * 0.5 + this.animOffset) * 0.1;
            ctx.rotate(jitter);

            // Spikes
            ctx.fillStyle = COLORS.enemy;
            for (let i = 0; i < 8; i++) {
                ctx.rotate(Math.PI / 4);
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(5, 5);
                ctx.lineTo(-5, 5);
                ctx.fill();

                // Outer spikes
                ctx.beginPath();
                ctx.moveTo(0, -14 - (Math.sin(globalTime + i) * 2));
                ctx.lineTo(3, -8);
                ctx.lineTo(-3, -8);
                ctx.fill();
            }

            // Core
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#aa0000';
            ctx.fill();

            // Evil Eyes
            ctx.fillStyle = '#fff';
            ctx.fillRect(-4, -2, 3, 3);
            ctx.fillRect(1, -2, 3, 3);

            ctx.restore();
        }
    }

    // --- Systems ---

    function createExplosionParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1.0,
                color: color
            });
        }
    }

    function generateLevel() {
        grid = [];
        entities = [];
        enemies = [];
        bombs = [];
        explosions = [];
        particles = [];
        powerups = [];
        timeLeft = 180;
        fireUpsSpawned = 0;
        timerEl.innerText = "3:00";

        for (let y = 0; y < GRID_ROWS; y++) {
            const row = [];
            for (let x = 0; x < GRID_COLS; x++) {
                if (x === 0 || x === GRID_COLS - 1 || y === 0 || y === GRID_ROWS - 1) row.push(1);
                else if (x % 2 === 0 && y % 2 === 0) row.push(1);
                else if (Math.random() < 0.3 && !(x < 3 && y < 3)) row.push(2);
                else row.push(0);
            }
            grid.push(row);
        }
        player = new Player();

        let enemyCount = 3 + Math.floor(level * 1.5);
        while (enemyCount > 0) {
            const ex = Math.floor(Math.random() * GRID_COLS);
            const ey = Math.floor(Math.random() * GRID_ROWS);
            if (grid[ey][ex] === 0 && (ex > 5 || ey > 5)) {
                enemies.push(new Enemy(ex, ey));
                enemyCount--;
            }
        }
    }

    function drawMap() {
        // Background
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Walls and Floor
        for (let y = 0; y < GRID_ROWS; y++) {
            for (let x = 0; x < GRID_COLS; x++) {
                const cell = grid[y][x];
                const px = x * TILE_SIZE;
                const py = y * TILE_SIZE;

                if (cell === 1) { // Hard Wall
                    // Cyber Box
                    drawNeonRect(px, py, TILE_SIZE, TILE_SIZE, COLORS.wallHardStroke, false);
                    ctx.fillStyle = '#111133';
                    ctx.fillRect(px + 5, py + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                    // Circuit lines
                    ctx.strokeStyle = '#3333aa';
                    ctx.beginPath();
                    ctx.moveTo(px, py); ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE);
                    ctx.stroke();
                } else if (cell === 2) { // Soft Wall
                    // Destructible block
                    drawNeonRect(px, py, TILE_SIZE, TILE_SIZE, COLORS.wallSoft, true);
                    // Stripes
                    ctx.fillStyle = COLORS.wallSoft;
                    ctx.fillRect(px + 5, py + 10, TILE_SIZE - 10, 4);
                    ctx.fillRect(px + 5, py + 20, TILE_SIZE - 10, 4);
                } else {
                    // Floor grid texture
                    ctx.fillStyle = '#222';
                    ctx.fillRect(px + TILE_SIZE / 2 - 1, py + TILE_SIZE / 2 - 1, 2, 2);
                }
            }
        }

        // Draw PowerUps
        powerups.forEach(p => p.draw());
    }

    function gameLoop() {
        if (!gameRunning) return;
        frameId = requestAnimationFrame(gameLoop);
        globalTime += 0.2;

        // Timer Logic (assuming 60fps, decrement every ~60 frames)
        if (frameId % 60 === 0) {
            timeLeft--;
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            timerEl.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;

            if (timeLeft <= 0) {
                gameOver();
            }
        }

        player.update();
        bombs.forEach(b => b.update());
        explosions = explosions.filter(e => e.life > 0);
        explosions.forEach(e => e.update());
        enemies.forEach(e => e.update());

        // PowerUp Collection
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            if (player.gridX === p.gridX && player.gridY === p.gridY) {
                if (p.type === 'bomb') player.maxBombs++;
                if (p.type === 'fire') player.powerRange++;
                score += 50;
                scoreEl.innerText = score;
                createExplosionParticles(p.gridX * TILE_SIZE + TILE_SIZE / 2, p.gridY * TILE_SIZE + TILE_SIZE / 2, '#fff');
                powerups.splice(i, 1);
            }
        }

        // Particles
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) particles.splice(i, 1);
        });

        drawMap();
        bombs.forEach(b => b.draw());
        explosions.forEach(e => e.draw());
        enemies.forEach(e => e.draw());
        player.draw();

        // Draw Particles
        particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
        });
        ctx.globalAlpha = 1.0;
    }

    function startGame() {
        score = 0;
        level = 1;
        scoreEl.innerText = score;
        overlay.style.display = 'none';
        gameRunning = true;
        generateLevel();
        gameLoop();
    }

    function gameOver() {
        gameRunning = false;
        cancelAnimationFrame(frameId);
        overlayTitle.innerHTML = "SISTEMA COMPROMETIDO <i class='fas fa-skull'></i>";
        overlayMsg.innerHTML = `Puntuación: ${score}<br>Presiona INICIAR para reintentar.`;
        overlay.style.display = 'flex';
        const currentHigh = parseInt(localStorage.getItem('bomber-highscore') || 0);
        if (score > currentHigh) {
            localStorage.setItem('bomber-highscore', score);
            highScoreEl.innerText = score;
        }
        startBtn.onclick = startGame;
    }

    function gameWin() {
        gameRunning = false;
        cancelAnimationFrame(frameId);
        overlayTitle.innerHTML = "SECTOR LIMPIO <i class='fas fa-check-circle'></i>";
        overlayMsg.innerHTML = `Nivel ${level} Completado.<br>Puntuación: ${score}`;
        overlay.style.display = 'flex';
        startBtn.innerHTML = '<i class="fas fa-arrow-right"></i> SIGUIENTE SECTOR';
        startBtn.onclick = () => {
            level++;
            overlay.style.display = 'none';
            gameRunning = true;
            generateLevel();
            gameLoop();
        };
    }

    startBtn.addEventListener('click', startGame);
    highScoreEl.innerText = localStorage.getItem('bomber-highscore') || 0;
});
