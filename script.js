(function () {
    // DOM Elements
    const canvas = document.getElementById('tetrisCanvas');
    const ctx = canvas.getContext('2d');
    const previewCanvas = document.getElementById('previewCanvas');
    const previewCtx = previewCanvas.getContext('2d');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const levelDisplay = document.getElementById('levelDisplay');
    const linesDisplay = document.getElementById('linesDisplay');
    const levelBadge = document.getElementById('levelBadge');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const gameOverScore = document.getElementById('gameOverScore');
    const gamePanel = document.getElementById('gamePanel');
    const mobileControls = document.getElementById('mobileControls');

    // Constants
    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;
    const PIECES = [
        { name: 'I', shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#00e5ff', glow: 'rgba(0,229,255,0.7)' },
        { name: 'O', shape: [[1, 1], [1, 1]], color: '#ffe500', glow: 'rgba(255,229,0,0.7)' },
        { name: 'T', shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#b388ff', glow: 'rgba(179,136,255,0.7)' },
        { name: 'S', shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#00ff882f', glow: 'rgba(0,255,136,0.7)' },
        { name: 'Z', shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#ff1744', glow: 'rgba(255,23,68,0.7)' },
        { name: 'J', shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#448aff', glow: 'rgba(68,138,255,0.7)' },
        { name: 'L', shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#ff6d00', glow: 'rgba(255,109,0,0.7)' }
    ];

    // Game state
    let board = [];
    let currentPiece = null;
    let nextPiece = null;
    let score = 0;
    let level = 1;
    let linesCleared = 0;
    let gameRunning = false;
    let gamePaused = false;
    let gameOver = false;
    let dropInterval = 800;
    let lastDropTime = 0;
    let animationId = null;
    let clearingRows = [];
    let clearAnimationTimer = 0;
    const CLEAR_ANIMATION_DURATION = 250;
    let particles = [];
    let screenShake = 0;

    // Scaling
    let scale = 1;
    let scaledBlockSize = BLOCK_SIZE;

    function updateScale() {
        const maxWidth = Math.min(window.innerWidth - 40, 400);
        const maxHeight = Math.min(window.innerHeight - 200, 700);
        const fitWidth = maxWidth / COLS;
        const fitHeight = maxHeight / ROWS;
        scaledBlockSize = Math.floor(Math.min(fitWidth, fitHeight, BLOCK_SIZE));
        if (scaledBlockSize < 18) scaledBlockSize = 18;
        if (scaledBlockSize > BLOCK_SIZE) scaledBlockSize = BLOCK_SIZE;
        canvas.width = COLS * scaledBlockSize;
        canvas.height = ROWS * scaledBlockSize;
        canvas.style.maxWidth = (COLS * scaledBlockSize) + 'px';
        previewCanvas.width = 4 * (scaledBlockSize * 0.7);
        previewCanvas.height = 4 * (scaledBlockSize * 0.7);
    }

    function createBoard() {
        board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    }

    function getRandomPiece() {
        const idx = Math.floor(Math.random() * PIECES.length);
        const p = PIECES[idx];
        return {
            shape: p.shape.map(row => [...row]),
            color: p.color,
            glow: p.glow,
            name: p.name,
            x: Math.floor((COLS - p.shape[0].length) / 2),
            y: p.name === 'I' ? -1 : 0,
        };
    }

    function spawnPiece() {
        if (nextPiece === null) {
            currentPiece = getRandomPiece();
            nextPiece = getRandomPiece();
        } else {
            currentPiece = nextPiece;
            nextPiece = getRandomPiece();
        }
        if (!isValidPosition(currentPiece.shape, currentPiece.x, currentPiece.y)) {
            triggerGameOver();
            return false;
        }
        return true;
    }

    function isValidPosition(shape, px, py) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const bx = px + c;
                const by = py + r;
                if (bx < 0 || bx >= COLS || by >= ROWS) return false;
                if (by < 0) continue;
                if (board[by][bx] !== null) return false;
            }
        }
        return true;
    }

    function placePiece() {
        const { shape, x, y, color, glow } = currentPiece;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const bx = x + c;
                const by = y + r;
                if (by < 0) {
                    triggerGameOver();
                    return;
                }
                board[by][bx] = { color, glow };
            }
        }
        checkLines();
        if (!spawnPiece() && !gameOver) {
            triggerGameOver();
        }
    }

    function checkLines() {
        clearingRows = [];
        for (let r = 0; r < ROWS; r++) {
            if (board[r].every(cell => cell !== null)) {
                clearingRows.push(r);
            }
        }
        if (clearingRows.length > 0) {
            clearAnimationTimer = CLEAR_ANIMATION_DURATION;
            for (const row of clearingRows) {
                for (let c = 0; c < COLS; c++) {
                    const cell = board[row][c];
                    if (cell) spawnParticles(c, row, cell.color, cell.glow);
                }
            }
            screenShake = 150;
            setTimeout(() => {
                removeClearedRows();
                updateScore(clearingRows.length);
                clearingRows = [];
            }, CLEAR_ANIMATION_DURATION);
        }
    }

    function removeClearedRows() {
        const sorted = [...clearingRows].sort((a, b) => b - a);
        for (const row of sorted) {
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(null));
        }
    }

    function updateScore(linesCount) {
        const basePoints = [0, 100, 300, 500, 800];
        score += basePoints[linesCount] * level;
        linesCleared += linesCount;
        const newLevel = Math.floor(linesCleared / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            dropInterval = Math.max(50, 800 - (level - 1) * 60);
            levelBadge.textContent = 'LEVEL ' + level;
            levelBadge.classList.remove('pulse');
            void levelBadge.offsetWidth;
            levelBadge.classList.add('pulse');
        }
        updateDisplays();
        scoreDisplay.classList.remove('pop');
        void scoreDisplay.offsetWidth;
        scoreDisplay.classList.add('pop');
        linesDisplay.classList.remove('pop');
        void linesDisplay.offsetWidth;
        linesDisplay.classList.add('pop');
        if (newLevel > level - 1 || linesCount >= 4) {
            levelDisplay.classList.remove('pop');
            void levelDisplay.offsetWidth;
            levelDisplay.classList.add('pop');
        }
    }

    function updateDisplays() {
        scoreDisplay.textContent = score.toLocaleString();
        levelDisplay.textContent = level;
        linesDisplay.textContent = linesCleared;
        levelBadge.textContent = 'LEVEL ' + level;
    }

    function spawnParticles(cx, cy, color, glow) {
        const x = cx * scaledBlockSize + scaledBlockSize / 2;
        const y = cy * scaledBlockSize + scaledBlockSize / 2;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                life: 1,
                decay: 0.02 + Math.random() * 0.04,
                size: 2 + Math.random() * 4,
                color, glow
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08;
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function triggerGameOver() {
        gameOver = true;
        gameRunning = false;
        gameOverScore.textContent = score.toLocaleString();
        gameOverOverlay.classList.add('active');
        updateDisplays();
    }

    function movePiece(dx, dy) {
        if (!gameRunning || gamePaused || gameOver || clearingRows.length > 0) return false;
        if (isValidPosition(currentPiece.shape, currentPiece.x + dx, currentPiece.y + dy)) {
            currentPiece.x += dx;
            currentPiece.y += dy;
            return true;
        }
        return false;
    }

    function rotatePiece() {
        if (!gameRunning || gamePaused || gameOver || clearingRows.length > 0) return;
        const shape = currentPiece.shape;
        const N = shape.length;
        const rotated = Array.from({ length: N }, (_, r) =>
            Array.from({ length: N }, (_, c) => shape[N - 1 - c][r])
        );
        if (isValidPosition(rotated, currentPiece.x, currentPiece.y)) {
            currentPiece.shape = rotated;
            return;
        }
        const kicks = [1, -1, 2, -2];
        for (const dx of kicks) {
            if (isValidPosition(rotated, currentPiece.x + dx, currentPiece.y)) {
                currentPiece.shape = rotated;
                currentPiece.x += dx;
                return;
            }
        }
        if (isValidPosition(rotated, currentPiece.x, currentPiece.y - 1)) {
            currentPiece.shape = rotated;
            currentPiece.y -= 1;
        }
    }

    function hardDrop() {
        if (!gameRunning || gamePaused || gameOver || clearingRows.length > 0) return;
        let dropDistance = 0;
        while (isValidPosition(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
            currentPiece.y++;
            dropDistance++;
        }
        score += dropDistance * 2;
        placePiece();
        updateDisplays();
        lastDropTime = performance.now();
    }

    function softDrop() {
        if (movePiece(0, 1)) {
            score += 1;
            updateDisplays();
            lastDropTime = performance.now();
        }
    }

    // Drawing (ghost piece removed)
    function drawBlock(context, x, y, color, glow, alpha = 1, size = scaledBlockSize) {
        const px = x * size;
        const py = y * size;
        const s = size;
        const inset = s * 0.08;

        context.save();
        context.globalAlpha = alpha * 0.6;
        context.shadowColor = glow;
        context.shadowBlur = s * 0.35;
        context.fillStyle = color;
        context.fillRect(px + inset, py + inset, s - inset * 2, s - inset * 2);
        context.restore();

        const grad = context.createLinearGradient(px, py, px + s, py + s);
        grad.addColorStop(0, color);
        grad.addColorStop(0.5, glow);
        grad.addColorStop(1, color);
        context.globalAlpha = alpha;
        context.fillStyle = grad;
        context.fillRect(px + inset, py + inset, s - inset * 2, s - inset * 2);

        context.fillStyle = 'rgba(255,255,255,0.3)';
        context.fillRect(px + inset, py + inset, s - inset * 2, (s - inset * 2) * 0.25);
        context.fillRect(px + inset, py + inset, (s - inset * 2) * 0.25, s - inset * 2);

        context.strokeStyle = 'rgba(255,255,255,0.25)';
        context.lineWidth = 1;
        context.strokeRect(px + inset, py + inset, s - inset * 2, s - inset * 2);
        context.globalAlpha = 1;
    }

    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * scaledBlockSize);
            ctx.lineTo(COLS * scaledBlockSize, r * scaledBlockSize);
            ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * scaledBlockSize, 0);
            ctx.lineTo(c * scaledBlockSize, ROWS * scaledBlockSize);
            ctx.stroke();
        }

        // Board blocks
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = board[r][c];
                if (cell) {
                    const isClearing = clearingRows.includes(r);
                    const alpha = isClearing ? 0.35 + Math.sin(Date.now() / 40) * 0.3 : 1;
                    drawBlock(ctx, c, r, cell.color, cell.glow, alpha);
                }
            }
        }

        // Current piece
        if (currentPiece && gameRunning && !gameOver && clearingRows.length === 0) {
            const { shape, x, y, color, glow } = currentPiece;
            for (let r = 0; r < shape.length; r++) {
                for (let c = 0; c < shape[r].length; c++) {
                    if (!shape[r][c]) continue;
                    const bx = x + c;
                    const by = y + r;
                    if (by < 0) continue;
                    drawBlock(ctx, bx, by, color, glow, 1);
                }
            }
        }

        // Clearing effect
        if (clearingRows.length > 0) {
            for (const row of clearingRows) {
                ctx.save();
                ctx.globalAlpha = 0.2 + Math.sin(Date.now() / 30) * 0.15;
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 20;
                ctx.fillRect(0, row * scaledBlockSize, COLS * scaledBlockSize, scaledBlockSize);
                ctx.restore();
            }
        }

        // Particles
        for (const p of particles) {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.glow;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawPreview() {
        const pSize = scaledBlockSize * 0.7;
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        if (!nextPiece) return;
        const { shape, color, glow } = nextPiece;
        const offsetX = (previewCanvas.width - shape[0].length * pSize) / 2;
        const offsetY = (previewCanvas.height - shape.length * pSize) / 2;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) continue;
                const px = offsetX + c * pSize;
                const py = offsetY + r * pSize;
                const s = pSize;
                const inset = s * 0.08;
                previewCtx.save();
                previewCtx.shadowColor = glow;
                previewCtx.shadowBlur = s * 0.3;
                const grad = previewCtx.createLinearGradient(px, py, px + s, py + s);
                grad.addColorStop(0, color);
                grad.addColorStop(0.5, glow);
                grad.addColorStop(1, color);
                previewCtx.fillStyle = grad;
                previewCtx.fillRect(px + inset, py + inset, s - inset * 2, s - inset * 2);
                previewCtx.fillStyle = 'rgba(255,255,255,0.3)';
                previewCtx.fillRect(px + inset, py + inset, s - inset * 2, (s - inset * 2) * 0.25);
                previewCtx.restore();
            }
        }
    }

    // Game loop
    function gameLoop(timestamp) {
        if (!gameRunning && !gameOver && clearingRows.length === 0) {
            animationId = requestAnimationFrame(gameLoop);
            drawBoard();
            drawPreview();
            return;
        }
        if (gamePaused) {
            animationId = requestAnimationFrame(gameLoop);
            drawBoard();
            drawPreview();
            return;
        }
        if (gameOver) {
            drawBoard();
            drawPreview();
            animationId = requestAnimationFrame(gameLoop);
            return;
        }

        if (clearingRows.length === 0 && gameRunning && !gameOver) {
            if (timestamp - lastDropTime > dropInterval) {
                if (!movePiece(0, 1)) placePiece();
                lastDropTime = timestamp;
            }
        } else if (clearingRows.length > 0) {
            clearAnimationTimer -= 16.67;
            if (clearAnimationTimer <= 0) {
                clearingRows = [];
                clearAnimationTimer = 0;
            }
        }

        if (screenShake > 0) {
            screenShake -= 16.67;
            const shakeX = (Math.random() - 0.5) * (screenShake / 150) * 6;
            const shakeY = (Math.random() - 0.5) * (screenShake / 150) * 6;
            canvas.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
            if (screenShake <= 0) {
                canvas.style.transform = '';
                screenShake = 0;
            }
        }

        updateParticles(16.67);
        drawBoard();
        drawPreview();
        animationId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        createBoard();
        score = 0;
        level = 1;
        linesCleared = 0;
        dropInterval = 800;
        gameRunning = true;
        gamePaused = false;
        gameOver = false;
        clearingRows = [];
        clearAnimationTimer = 0;
        particles = [];
        screenShake = 0;
        currentPiece = null;
        nextPiece = null;
        gameOverOverlay.classList.remove('active');
        canvas.style.transform = '';
        updateDisplays();
        levelBadge.textContent = 'LEVEL 1';
        spawnPiece();
        lastDropTime = performance.now();
        updateDisplays();
        if (!animationId) animationId = requestAnimationFrame(gameLoop);
    }

    function restartGame() { startGame(); }

    // Input
    const heldKeys = {};
    const keyTimers = {};
    const keyRepeatDelay = 170;
    const keyRepeatRate = 50;

    function handleKeyDown(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowDown') e.preventDefault();
        if (heldKeys[e.key]) return;
        heldKeys[e.key] = true;
        processKey(e.key);
        if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.key)) {
            keyTimers[e.key] = setTimeout(() => {
                keyTimers[e.key + '_repeat'] = setInterval(() => processKey(e.key), keyRepeatRate);
            }, keyRepeatDelay);
        }
    }

    function handleKeyUp(e) {
        heldKeys[e.key] = false;
        if (keyTimers[e.key]) { clearTimeout(keyTimers[e.key]); delete keyTimers[e.key]; }
        if (keyTimers[e.key + '_repeat']) { clearInterval(keyTimers[e.key + '_repeat']); delete keyTimers[e.key + '_repeat']; }
    }

    function processKey(key) {
        if (gameOver) return;
        if (key === 'ArrowLeft') movePiece(-1, 0);
        if (key === 'ArrowRight') movePiece(1, 0);
        if (key === 'ArrowDown') softDrop();
        if (key === 'ArrowUp') rotatePiece();
        if (key === ' ' || key === 'Spacebar') hardDrop();
        if (key === 'p' || key === 'P') togglePause();
        if (key === 'r' || key === 'R') restartGame();
    }

    function togglePause() {
        if (gameOver) return;
        gamePaused = !gamePaused;
        if (!gamePaused) lastDropTime = performance.now();
    }

    function setupMobileControls() {
        const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || window.innerWidth < 601;
        mobileControls.style.display = isMobile ? 'flex' : 'none';

        document.getElementById('btnLeft').addEventListener('pointerdown', (e) => { e.preventDefault(); movePiece(-1, 0); });
        document.getElementById('btnRight').addEventListener('pointerdown', (e) => { e.preventDefault(); movePiece(1, 0); });
        document.getElementById('btnDown').addEventListener('pointerdown', (e) => { e.preventDefault(); softDrop(); });
        document.getElementById('btnRotate').addEventListener('pointerdown', (e) => { e.preventDefault(); rotatePiece(); });
        document.getElementById('btnHardDrop').addEventListener('pointerdown', (e) => { e.preventDefault(); hardDrop(); });

        document.querySelectorAll('.ctrl-btn').forEach(btn => {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); btn.click(); });
        });
    }

    // Touch gestures on canvas
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!gameRunning || gamePaused || gameOver) return;
        const dx = (e.changedTouches[0]?.clientX || touchStartX) - touchStartX;
        const dy = (e.changedTouches[0]?.clientY || touchStartY) - touchStartY;
        const dt = Date.now() - touchStartTime;
        const absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (absDx < 10 && absDy < 10 && dt < 300) {
            rotatePiece();
        } else if (absDy > absDx && dy > 40 && dt < 500) {
            hardDrop();
        } else if (absDx > absDy && absDx > 25) {
            if (dx > 0) movePiece(1, 0); else movePiece(-1, 0);
        }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.getElementById('btnRestart').addEventListener('click', restartGame);
    document.getElementById('btnRestartOverlay').addEventListener('click', restartGame);
    document.getElementById('btnPause').addEventListener('click', togglePause);

    let resizeDebounce;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => { updateScale(); setupMobileControls(); }, 200);
    });

    document.getElementById('gameWrapper').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    function init() {
        updateScale();
        setupMobileControls();
        startGame();
        animationId = requestAnimationFrame(gameLoop);
    }

    init();
    console.log('🚀 Neon Tetris (no ghost piece)');
})();