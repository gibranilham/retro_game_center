(function () {
  "use strict";

  const BASE_WIDTH = 180;
  const BASE_HEIGHT = 292;
  const storageKey = "breakout-best";

  const PADDLE_WIDTH = 36;
  const PADDLE_HEIGHT = 6;
  const PADDLE_Y = BASE_HEIGHT - 16;
  const PADDLE_KEY_SPEED = 160;
  const PADDLE_MARGIN = 4;

  const BALL_RADIUS = 3;
  const BALL_BASE_SPEED = 110;
  const BALL_SPEED_STEP = 8;
  const BALL_PADDLE_SPEED_STEP = 5;
  const BALL_MAX_SPEED = 240;
  const BALL_LAUNCH_DELAY = 600;
  const BALL_MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

  const BRICK_ROWS = 6;
  const BRICK_COLS = 8;
  const BRICK_MARGIN = 8;
  const BRICK_GAP = 3;
  const BRICK_TOP = 20;
  const BRICK_HEIGHT = 9;
  const BRICK_AREA_WIDTH = BASE_WIDTH - BRICK_MARGIN * 2;
  const BRICK_WIDTH = (BRICK_AREA_WIDTH - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;

  const LIVES_START = 3;

  const canvas = document.getElementById("gameCanvas");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const livesValue = document.getElementById("livesValue");
  const restartButton = document.getElementById("restartButton");
  const ctx = canvas.getContext("2d");

  let cellSize;
  let paddle;
  let ball;
  let bricks;
  let score;
  let highScore;
  let lives;
  let wave;
  let gameRunning;
  let leftPressed;
  let rightPressed;
  let lastTime;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function padScore(value) {
    return String(value).padStart(3, "0");
  }

  function resizeCanvas() {
    const displayWidth = Math.floor(canvas.clientWidth);
    const displayHeight = Math.floor(canvas.clientHeight);
    const ratio = window.devicePixelRatio || 1;

    canvas.width = displayWidth * ratio;
    canvas.height = displayHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cellSize = displayWidth / BASE_WIDTH;

    if (paddle) {
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

  function rowColor(row) {
    if (row < 2) {
      return "#d0d0d0";
    }

    if (row < 4) {
      return "#aaaaaa";
    }

    return "#888888";
  }

  function buildBricks() {
    bricks = [];

    for (let row = 0; row < BRICK_ROWS; row += 1) {
      const cols = [];

      for (let col = 0; col < BRICK_COLS; col += 1) {
        cols.push(true);
      }

      bricks.push(cols);
    }
  }

  function brickX(col) {
    return BRICK_MARGIN + col * (BRICK_WIDTH + BRICK_GAP);
  }

  function brickY(row) {
    return BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP);
  }

  function countAliveBricks() {
    let count = 0;

    bricks.forEach((row) => {
      row.forEach((alive) => {
        if (alive) {
          count += 1;
        }
      });
    });

    return count;
  }

  function waveSpeed() {
    return Math.min(BALL_MAX_SPEED, BALL_BASE_SPEED + (wave - 1) * BALL_SPEED_STEP);
  }

  function attachBall() {
    ball = {
      x: paddle.x + PADDLE_WIDTH / 2,
      y: PADDLE_Y - BALL_RADIUS - 1,
      vx: 0,
      vy: 0,
      attached: true,
      launchTimer: BALL_LAUNCH_DELAY
    };
  }

  function launchBall() {
    const angle = (Math.random() - 0.5) * (BALL_MAX_BOUNCE_ANGLE * 0.6);

    ball.attached = false;
    ball.speed = waveSpeed();
    ball.vx = ball.speed * Math.sin(angle);
    ball.vy = -ball.speed * Math.cos(angle);
  }

  function resetGame() {
    wave = 1;
    score = 0;
    lives = LIVES_START;
    highScore = loadHighScore();
    gameRunning = true;
    leftPressed = false;
    rightPressed = false;
    lastTime = 0;
    paddle = { x: (BASE_WIDTH - PADDLE_WIDTH) / 2 };

    buildBricks();
    attachBall();
    updateScoreBoard();
    draw();
  }

  function nextWave() {
    wave += 1;
    buildBricks();
    attachBall();
  }

  function loseLife() {
    lives -= 1;
    updateScoreBoard();

    if (lives <= 0) {
      endGame();
      return;
    }

    attachBall();
  }

  function endGame() {
    gameRunning = false;
    saveHighScoreIfNeeded();
    updateScoreBoard();
  }

  function setPaddleCenter(localX) {
    paddle.x = clamp(
      localX - PADDLE_WIDTH / 2,
      PADDLE_MARGIN,
      BASE_WIDTH - PADDLE_WIDTH - PADDLE_MARGIN
    );
  }

  function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;

    return dx * dx + dy * dy <= r * r;
  }

  function updatePaddle(dt) {
    if (leftPressed) {
      paddle.x -= PADDLE_KEY_SPEED * dt;
    }

    if (rightPressed) {
      paddle.x += PADDLE_KEY_SPEED * dt;
    }

    paddle.x = clamp(paddle.x, PADDLE_MARGIN, BASE_WIDTH - PADDLE_WIDTH - PADDLE_MARGIN);
  }

  function updateBall(dt) {
    if (ball.attached) {
      ball.x = paddle.x + PADDLE_WIDTH / 2;
      ball.y = PADDLE_Y - BALL_RADIUS - 1;
      ball.launchTimer -= dt * 1000;

      if (ball.launchTimer <= 0) {
        launchBall();
      }

      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - BALL_RADIUS < 0) {
      ball.x = BALL_RADIUS;
      ball.vx = -ball.vx;
    } else if (ball.x + BALL_RADIUS > BASE_WIDTH) {
      ball.x = BASE_WIDTH - BALL_RADIUS;
      ball.vx = -ball.vx;
    }

    if (ball.y - BALL_RADIUS < 0) {
      ball.y = BALL_RADIUS;
      ball.vy = -ball.vy;
    }

    if (ball.y - BALL_RADIUS > BASE_HEIGHT) {
      loseLife();
      return;
    }

    if (
      ball.vy > 0 &&
      circleRectOverlap(ball.x, ball.y, BALL_RADIUS, paddle.x, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT)
    ) {
      const offset = clamp((ball.x - (paddle.x + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2), -1, 1);
      const angle = offset * BALL_MAX_BOUNCE_ANGLE;

      ball.speed = Math.min(BALL_MAX_SPEED, ball.speed + BALL_PADDLE_SPEED_STEP);
      ball.y = PADDLE_Y - BALL_RADIUS;
      ball.vx = ball.speed * Math.sin(angle);
      ball.vy = -ball.speed * Math.cos(angle);
      return;
    }

    for (let row = 0; row < BRICK_ROWS; row += 1) {
      for (let col = 0; col < BRICK_COLS; col += 1) {
        if (!bricks[row][col]) {
          continue;
        }

        const bx = brickX(col);
        const by = brickY(row);

        if (!circleRectOverlap(ball.x, ball.y, BALL_RADIUS, bx, by, BRICK_WIDTH, BRICK_HEIGHT)) {
          continue;
        }

        bricks[row][col] = false;
        score += rowScore(row);
        saveHighScoreIfNeeded();
        updateScoreBoard();

        const overlapLeft = ball.x + BALL_RADIUS - bx;
        const overlapRight = bx + BRICK_WIDTH - (ball.x - BALL_RADIUS);
        const overlapTop = ball.y + BALL_RADIUS - by;
        const overlapBottom = by + BRICK_HEIGHT - (ball.y - BALL_RADIUS);
        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        if (minOverlapX < minOverlapY) {
          ball.vx = -ball.vx;
        } else {
          ball.vy = -ball.vy;
        }

        if (countAliveBricks() === 0) {
          nextWave();
        }

        return;
      }
    }
  }

  function update(dt) {
    updatePaddle(dt);
    updateBall(dt);
  }

  function draw() {
    if (!cellSize || !paddle) {
      return;
    }

    const width = BASE_WIDTH * cellSize;
    const height = BASE_HEIGHT * cellSize;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, width, height);

    drawBricks();
    drawPaddle();
    drawBall();

    if (!gameRunning) {
      drawGameOver();
    }
  }

  function drawBricks() {
    for (let row = 0; row < BRICK_ROWS; row += 1) {
      ctx.fillStyle = rowColor(row);

      for (let col = 0; col < BRICK_COLS; col += 1) {
        if (bricks[row][col]) {
          ctx.fillRect(
            brickX(col) * cellSize,
            brickY(row) * cellSize,
            Math.ceil(BRICK_WIDTH * cellSize),
            Math.ceil(BRICK_HEIGHT * cellSize)
          );
        }
      }
    }
  }

  function drawPaddle() {
    ctx.fillStyle = "#d0d0d0";
    ctx.fillRect(
      paddle.x * cellSize,
      PADDLE_Y * cellSize,
      PADDLE_WIDTH * cellSize,
      PADDLE_HEIGHT * cellSize
    );
  }

  function drawBall() {
    ctx.fillStyle = "#d0d0d0";
    ctx.beginPath();
    ctx.arc(ball.x * cellSize, ball.y * cellSize, BALL_RADIUS * cellSize, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGameOver() {
    const width = BASE_WIDTH * cellSize;
    const height = BASE_HEIGHT * cellSize;

    ctx.fillStyle = "rgba(10, 10, 10, 0.78)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#d0d0d0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.max(14, Math.floor(width / 13))}px "Press Start 2P", monospace`;
    ctx.fillText("GAME OVER", width / 2, height / 2 - 36);
    ctx.font = `${Math.max(9, Math.floor(width / 24))}px "Press Start 2P", monospace`;
    ctx.fillText(`SCORE ${padScore(score)}`, width / 2, height / 2 + 4);
    ctx.fillText("PRESS SPACE", width / 2, height / 2 + 42);
    ctx.fillText("TO RESTART", width / 2, height / 2 + 68);
  }

  function loop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    dt = Math.min(dt, 0.05);

    if (gameRunning) {
      update(dt);
    }

    draw();
    window.requestAnimationFrame(loop);
  }

  function handlePointerMove(event) {
    if (!gameRunning) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * BASE_WIDTH;
    setPaddleCenter(localX);
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

      if (!gameRunning) {
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

  canvas.addEventListener("pointermove", handlePointerMove);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  restartButton.addEventListener("click", resetGame);
  window.addEventListener("resize", resizeCanvas);

  highScore = loadHighScore();
  resizeCanvas();
  resetGame();
  window.requestAnimationFrame(loop);
}());
