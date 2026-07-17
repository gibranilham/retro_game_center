(function () {
  "use strict";

  const BASE_SIZE = 240;
  const storageKey = "invaders-best";

  const PLAYER_WIDTH = 20;
  const PLAYER_HEIGHT = 10;
  const PLAYER_SPEED = 130;
  const PLAYER_Y = BASE_SIZE - 24;
  const PLAYER_BULLET_SPEED = 260;
  const PLAYER_BULLET_W = 2;
  const PLAYER_BULLET_H = 8;
  const LIVES_START = 3;
  const INVULN_MS = 1200;

  const ALIEN_ROWS = 5;
  const ALIEN_COLS = 8;
  const ALIEN_W = 14;
  const ALIEN_H = 10;
  const ALIEN_GAP_X = 8;
  const ALIEN_GAP_Y = 10;
  const ALIEN_FORMATION_WIDTH = ALIEN_COLS * ALIEN_W + (ALIEN_COLS - 1) * ALIEN_GAP_X;
  const ALIEN_START_X = (BASE_SIZE - ALIEN_FORMATION_WIDTH) / 2;
  const ALIEN_START_Y = 26;
  const ALIEN_STEP_X = 4;
  const ALIEN_DROP_Y = 8;
  const ALIEN_EDGE_MARGIN = 10;
  const ALIEN_BULLET_SPEED = 130;
  const ALIEN_BULLET_W = 2;
  const ALIEN_BULLET_H = 8;
  const ALIEN_BULLET_MAX = 3;

  const SHIELD_COUNT = 4;
  const SHIELD_COLS = 8;
  const SHIELD_ROWS = 5;
  const SHIELD_BLOCK = 3;
  const SHIELD_WIDTH = SHIELD_COLS * SHIELD_BLOCK;
  const SHIELD_HEIGHT = SHIELD_ROWS * SHIELD_BLOCK;
  const SHIELD_Y = PLAYER_Y - 46;

  const ALIEN_FRAMES = [
    [
      "00111100",
      "01111110",
      "11011011",
      "11111111",
      "01100110",
      "10111101",
      "10100101",
      "00100100"
    ],
    [
      "00111100",
      "01111110",
      "11011011",
      "11111111",
      "00111100",
      "01011010",
      "10100101",
      "01000010"
    ]
  ];

  const PLAYER_SPRITE = [
    "00011000",
    "00111100",
    "00111100",
    "11111111",
    "11111111",
    "11111111"
  ];

  const canvas = document.getElementById("gameCanvas");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const livesValue = document.getElementById("livesValue");
  const restartButton = document.getElementById("restartButton");
  const ctx = canvas.getContext("2d");

  let cellSize;
  let player;
  let playerBullet;
  let alienBullets;
  let aliens;
  let alienDirection;
  let alienOffsetX;
  let alienOffsetY;
  let alienStepAccumulator;
  let alienFireTimer;
  let alienFrame;
  let shields;
  let score;
  let highScore;
  let lives;
  let wave;
  let gameRunning;
  let invulnerableUntil;
  let leftPressed;
  let rightPressed;
  let lastTime;
  let animationFrame;

  function padScore(value) {
    return String(value).padStart(3, "0");
  }

  function resizeCanvas() {
    const displaySize = Math.floor(canvas.clientWidth);
    const ratio = window.devicePixelRatio || 1;

    canvas.width = displaySize * ratio;
    canvas.height = displaySize * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cellSize = displaySize / BASE_SIZE;

    if (player) {
      draw();
    }
  }

  function loadHighScore() {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      return Number.isFinite(stored) ? stored : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveHighScoreIfNeeded() {
    if (score <= highScore) {
      return;
    }

    highScore = score;

    try {
      localStorage.setItem(storageKey, String(highScore));
    } catch (error) {
      // Keep gameplay running if browser storage is unavailable.
    }
  }

  function updateScoreBoard() {
    scoreValue.value = padScore(score);
    bestValue.value = padScore(highScore);
    livesValue.value = String(Math.max(0, lives));
  }

  function rowScore(row) {
    if (row < 2) {
      return 30;
    }

    if (row < 4) {
      return 20;
    }

    return 10;
  }

  function buildWave() {
    aliens = [];

    for (let row = 0; row < ALIEN_ROWS; row += 1) {
      const cols = [];

      for (let col = 0; col < ALIEN_COLS; col += 1) {
        cols.push(true);
      }

      aliens.push(cols);
    }

    alienDirection = 1;
    alienOffsetX = 0;
    alienOffsetY = 0;
    alienStepAccumulator = 0;
    alienFrame = 0;
    alienFireTimer = randomFireDelay();
  }

  function buildShields() {
    shields = [];
    const gap = (BASE_SIZE - SHIELD_COUNT * SHIELD_WIDTH) / (SHIELD_COUNT + 1);
    const midA = Math.floor(SHIELD_COLS / 2) - 1;
    const midB = Math.floor(SHIELD_COLS / 2);

    for (let i = 0; i < SHIELD_COUNT; i += 1) {
      const blocks = [];

      for (let row = 0; row < SHIELD_ROWS; row += 1) {
        const cols = [];

        for (let col = 0; col < SHIELD_COLS; col += 1) {
          const isArch = row >= SHIELD_ROWS - 2 && (col === midA || col === midB);
          cols.push(!isArch);
        }

        blocks.push(cols);
      }

      shields.push({
        x: gap + i * (SHIELD_WIDTH + gap),
        y: SHIELD_Y,
        blocks: blocks
      });
    }
  }

  function alienStepInterval() {
    const total = ALIEN_ROWS * ALIEN_COLS;
    const alive = countAliveAliens();
    const base = Math.max(220, 760 - (wave - 1) * 60);
    const factor = 0.35 + 0.65 * (alive / total);

    return Math.max(70, base * factor);
  }

  function randomFireDelay() {
    const min = Math.max(280, 900 - (wave - 1) * 60);
    const max = min + 700;

    return min + Math.random() * (max - min);
  }

  function countAliveAliens() {
    let count = 0;

    aliens.forEach((row) => {
      row.forEach((alive) => {
        if (alive) {
          count += 1;
        }
      });
    });

    return count;
  }

  function alienX(col) {
    return ALIEN_START_X + col * (ALIEN_W + ALIEN_GAP_X) + alienOffsetX;
  }

  function alienY(row) {
    return ALIEN_START_Y + row * (ALIEN_H + ALIEN_GAP_Y) + alienOffsetY;
  }

  function aliveColumns() {
    const cols = [];

    for (let col = 0; col < ALIEN_COLS; col += 1) {
      let hasAlive = false;

      for (let row = 0; row < ALIEN_ROWS; row += 1) {
        if (aliens[row][col]) {
          hasAlive = true;
          break;
        }
      }

      if (hasAlive) {
        cols.push(col);
      }
    }

    return cols;
  }

  function bottomAlienRow(col) {
    for (let row = ALIEN_ROWS - 1; row >= 0; row -= 1) {
      if (aliens[row][col]) {
        return row;
      }
    }

    return -1;
  }

  function resetGame() {
    wave = 1;
    score = 0;
    lives = LIVES_START;
    highScore = loadHighScore();
    gameRunning = true;
    invulnerableUntil = 0;
    leftPressed = false;
    rightPressed = false;
    player = { x: (BASE_SIZE - PLAYER_WIDTH) / 2 };
    playerBullet = null;
    alienBullets = [];
    lastTime = 0;

    buildWave();
    buildShields();
    updateScoreBoard();
    draw();
  }

  function nextWave() {
    wave += 1;
    player.x = (BASE_SIZE - PLAYER_WIDTH) / 2;
    playerBullet = null;
    alienBullets = [];
    buildWave();
    buildShields();
  }

  function loseLife() {
    lives -= 1;
    updateScoreBoard();

    if (lives <= 0) {
      endGame();
      return;
    }

    player.x = (BASE_SIZE - PLAYER_WIDTH) / 2;
    playerBullet = null;
    invulnerableUntil = performance.now() + INVULN_MS;
  }

  function endGame() {
    gameRunning = false;
    saveHighScoreIfNeeded();
    updateScoreBoard();
  }

  function tryFire() {
    if (!gameRunning || playerBullet) {
      return;
    }

    playerBullet = {
      x: player.x + PLAYER_WIDTH / 2 - PLAYER_BULLET_W / 2,
      y: PLAYER_Y - PLAYER_BULLET_H
    };
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function shieldHit(shield, bx, by, bw, bh) {
    const localLeft = bx - shield.x;
    const localTop = by - shield.y;

    if (localLeft + bw < 0 || localLeft > SHIELD_WIDTH || localTop + bh < 0 || localTop > SHIELD_HEIGHT) {
      return false;
    }

    const colStart = Math.max(0, Math.floor(localLeft / SHIELD_BLOCK));
    const colEnd = Math.min(SHIELD_COLS - 1, Math.floor((localLeft + bw) / SHIELD_BLOCK));
    const rowStart = Math.max(0, Math.floor(localTop / SHIELD_BLOCK));
    const rowEnd = Math.min(SHIELD_ROWS - 1, Math.floor((localTop + bh) / SHIELD_BLOCK));
    let hit = false;

    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let col = colStart; col <= colEnd; col += 1) {
        if (shield.blocks[row][col]) {
          hit = true;
        }
      }
    }

    if (!hit) {
      return false;
    }

    for (let row = rowStart - 1; row <= rowEnd + 1; row += 1) {
      for (let col = colStart - 1; col <= colEnd + 1; col += 1) {
        if (row >= 0 && row < SHIELD_ROWS && col >= 0 && col < SHIELD_COLS) {
          shield.blocks[row][col] = false;
        }
      }
    }

    return true;
  }

  function updatePlayer(dt) {
    if (leftPressed) {
      player.x -= PLAYER_SPEED * dt;
    }

    if (rightPressed) {
      player.x += PLAYER_SPEED * dt;
    }

    player.x = Math.max(4, Math.min(BASE_SIZE - PLAYER_WIDTH - 4, player.x));
  }

  function updatePlayerBullet(dt) {
    if (!playerBullet) {
      return;
    }

    playerBullet.y -= PLAYER_BULLET_SPEED * dt;

    if (playerBullet.y + PLAYER_BULLET_H < 0) {
      playerBullet = null;
      return;
    }

    for (let i = 0; i < shields.length; i += 1) {
      if (shieldHit(shields[i], playerBullet.x, playerBullet.y, PLAYER_BULLET_W, PLAYER_BULLET_H)) {
        playerBullet = null;
        return;
      }
    }

    for (let row = 0; row < ALIEN_ROWS; row += 1) {
      for (let col = 0; col < ALIEN_COLS; col += 1) {
        if (!aliens[row][col]) {
          continue;
        }

        const ax = alienX(col);
        const ay = alienY(row);

        if (rectsOverlap(playerBullet.x, playerBullet.y, PLAYER_BULLET_W, PLAYER_BULLET_H, ax, ay, ALIEN_W, ALIEN_H)) {
          aliens[row][col] = false;
          score += rowScore(row);
          saveHighScoreIfNeeded();
          updateScoreBoard();
          playerBullet = null;
          return;
        }
      }
    }
  }

  function updateAlienBullets(dt) {
    for (let i = alienBullets.length - 1; i >= 0; i -= 1) {
      const bullet = alienBullets[i];
      bullet.y += ALIEN_BULLET_SPEED * dt;

      if (bullet.y > BASE_SIZE) {
        alienBullets.splice(i, 1);
        continue;
      }

      let consumed = false;

      for (let s = 0; s < shields.length; s += 1) {
        if (shieldHit(shields[s], bullet.x, bullet.y, ALIEN_BULLET_W, ALIEN_BULLET_H)) {
          alienBullets.splice(i, 1);
          consumed = true;
          break;
        }
      }

      if (consumed) {
        continue;
      }

      const invulnerable = performance.now() < invulnerableUntil;

      if (
        !invulnerable &&
        gameRunning &&
        rectsOverlap(bullet.x, bullet.y, ALIEN_BULLET_W, ALIEN_BULLET_H, player.x, PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT)
      ) {
        alienBullets.splice(i, 1);
        loseLife();
      }
    }
  }

  function updateAliens(dt, timestamp) {
    const columns = aliveColumns();

    if (columns.length === 0) {
      nextWave();
      return;
    }

    alienStepAccumulator += dt * 1000;
    const interval = alienStepInterval();

    if (alienStepAccumulator >= interval) {
      alienStepAccumulator = 0;
      alienFrame = alienFrame === 0 ? 1 : 0;

      const minCol = Math.min(...columns);
      const maxCol = Math.max(...columns);
      const leftEdge = alienX(minCol);
      const rightEdge = alienX(maxCol) + ALIEN_W;

      if (alienDirection > 0 && rightEdge + ALIEN_STEP_X > BASE_SIZE - ALIEN_EDGE_MARGIN) {
        alienDirection = -1;
        alienOffsetY += ALIEN_DROP_Y;
      } else if (alienDirection < 0 && leftEdge - ALIEN_STEP_X < ALIEN_EDGE_MARGIN) {
        alienDirection = 1;
        alienOffsetY += ALIEN_DROP_Y;
      } else {
        alienOffsetX += ALIEN_STEP_X * alienDirection;
      }

      for (let row = 0; row < ALIEN_ROWS; row += 1) {
        for (let col = 0; col < ALIEN_COLS; col += 1) {
          if (aliens[row][col] && alienY(row) + ALIEN_H >= PLAYER_Y) {
            endGame();
            return;
          }
        }
      }
    }

    alienFireTimer -= dt * 1000;

    if (alienFireTimer <= 0 && alienBullets.length < ALIEN_BULLET_MAX) {
      const shooterCol = columns[Math.floor(Math.random() * columns.length)];
      const shooterRow = bottomAlienRow(shooterCol);

      if (shooterRow >= 0) {
        alienBullets.push({
          x: alienX(shooterCol) + ALIEN_W / 2 - ALIEN_BULLET_W / 2,
          y: alienY(shooterRow) + ALIEN_H
        });
      }

      alienFireTimer = randomFireDelay();
    }
  }

  function update(dt, timestamp) {
    updatePlayer(dt);
    updatePlayerBullet(dt);
    updateAlienBullets(dt);

    if (gameRunning) {
      updateAliens(dt, timestamp);
    }
  }

  function drawSprite(sprite, x, y, width, height, color) {
    const cols = sprite[0].length;
    const rows = sprite.length;
    const blockW = width / cols;
    const blockH = height / rows;

    ctx.fillStyle = color;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (sprite[row][col] === "1") {
          ctx.fillRect(
            (x + col * blockW) * cellSize,
            (y + row * blockH) * cellSize,
            Math.ceil(blockW * cellSize),
            Math.ceil(blockH * cellSize)
          );
        }
      }
    }
  }

  function draw() {
    if (!cellSize || !player) {
      return;
    }

    const size = BASE_SIZE * cellSize;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, size, size);

    drawShields();
    drawAliens();
    drawBullets();
    drawPlayer();

    if (!gameRunning) {
      drawGameOver();
    }
  }

  function drawShields() {
    ctx.fillStyle = "#5c5c5c";

    shields.forEach((shield) => {
      for (let row = 0; row < SHIELD_ROWS; row += 1) {
        for (let col = 0; col < SHIELD_COLS; col += 1) {
          if (shield.blocks[row][col]) {
            ctx.fillRect(
              (shield.x + col * SHIELD_BLOCK) * cellSize,
              (shield.y + row * SHIELD_BLOCK) * cellSize,
              Math.ceil(SHIELD_BLOCK * cellSize),
              Math.ceil(SHIELD_BLOCK * cellSize)
            );
          }
        }
      }
    });
  }

  function drawAliens() {
    for (let row = 0; row < ALIEN_ROWS; row += 1) {
      const color = row < 2 ? "#d0d0d0" : row < 4 ? "#aaaaaa" : "#888888";

      for (let col = 0; col < ALIEN_COLS; col += 1) {
        if (aliens[row][col]) {
          drawSprite(ALIEN_FRAMES[alienFrame], alienX(col), alienY(row), ALIEN_W, ALIEN_H, color);
        }
      }
    }
  }

  function drawBullets() {
    ctx.fillStyle = "#d0d0d0";

    if (playerBullet) {
      ctx.fillRect(
        playerBullet.x * cellSize,
        playerBullet.y * cellSize,
        PLAYER_BULLET_W * cellSize,
        PLAYER_BULLET_H * cellSize
      );
    }

    ctx.fillStyle = "#888888";
    alienBullets.forEach((bullet) => {
      ctx.fillRect(
        bullet.x * cellSize,
        bullet.y * cellSize,
        ALIEN_BULLET_W * cellSize,
        ALIEN_BULLET_H * cellSize
      );
    });
  }

  function drawPlayer() {
    const invulnerable = performance.now() < invulnerableUntil;

    if (invulnerable && Math.floor(performance.now() / 100) % 2 === 0) {
      return;
    }

    drawSprite(PLAYER_SPRITE, player.x, PLAYER_Y, PLAYER_WIDTH, PLAYER_HEIGHT, "#d0d0d0");
  }

  function drawGameOver() {
    const size = BASE_SIZE * cellSize;

    ctx.fillStyle = "rgba(10, 10, 10, 0.78)";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#d0d0d0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(14, Math.floor(size / 18))}px "Press Start 2P", monospace`;
    ctx.fillText("GAME OVER", size / 2, size / 2 - 36);
    ctx.font = `${Math.max(9, Math.floor(size / 34))}px "Press Start 2P", monospace`;
    ctx.fillText(`SCORE ${padScore(score)}`, size / 2, size / 2 + 4);
    ctx.fillText("PRESS SPACE", size / 2, size / 2 + 42);
    ctx.fillText("TO RESTART", size / 2, size / 2 + 68);
  }

  function loop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    dt = Math.min(dt, 0.05);

    update(dt, timestamp);
    draw();
    animationFrame = window.requestAnimationFrame(loop);
  }

  function handleKeydown(event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      event.preventDefault();
      leftPressed = true;
      return;
    }

    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      event.preventDefault();
      rightPressed = true;
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      if (gameRunning) {
        tryFire();
      } else {
        resetGame();
      }
    }
  }

  function handleKeyup(event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      leftPressed = false;
      return;
    }

    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      rightPressed = false;
    }
  }

  function bindHoldButton(selector, onDown, onUp) {
    const button = document.querySelector(selector);

    if (!button) {
      return;
    }

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      onDown();
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
      button.addEventListener(type, () => onUp());
    });
  }

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  restartButton.addEventListener("click", resetGame);

  bindHoldButton(
    '[data-control="left"]',
    () => {
      leftPressed = true;
    },
    () => {
      leftPressed = false;
    }
  );
  bindHoldButton(
    '[data-control="right"]',
    () => {
      rightPressed = true;
    },
    () => {
      rightPressed = false;
    }
  );

  const fireButton = document.querySelector('[data-control="fire"]');

  if (fireButton) {
    fireButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      if (gameRunning) {
        tryFire();
      } else {
        resetGame();
      }
    });
  }

  window.addEventListener("resize", resizeCanvas);

  highScore = loadHighScore();
  resizeCanvas();
  resetGame();
  animationFrame = window.requestAnimationFrame(loop);
}());
