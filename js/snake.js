(function () {
  "use strict";

  const gridSize = 20;
  const tickRate = 150;
  const storageKey = "snake-best";
  const canvas = document.getElementById("gameCanvas");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const restartButton = document.getElementById("restartButton");
  const ctx = canvas.getContext("2d");

  let snake;
  let direction;
  let nextDirection;
  let food;
  let score;
  let highScore;
  let gameRunning;
  let gameLoop;
  let cellSize;

  const directionMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function padScore(value) {
    return String(value).padStart(3, "0");
  }

  function resizeCanvas() {
    const displaySize = Math.floor(canvas.clientWidth);
    const ratio = window.devicePixelRatio || 1;

    canvas.width = displaySize * ratio;
    canvas.height = displaySize * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cellSize = displaySize / gridSize;

    if (snake && food) {
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

  function updateScoreBoard() {
    scoreValue.value = padScore(score);
    bestValue.value = padScore(highScore);
  }

  function resetGame() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    direction = "right";
    nextDirection = "right";
    score = 0;
    highScore = loadHighScore();
    gameRunning = true;
    food = spawnFood();
    updateScoreBoard();

    window.clearInterval(gameLoop);
    gameLoop = window.setInterval(tick, tickRate);
    draw();
  }

  function spawnFood() {
    let candidate;

    do {
      candidate = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
    } while (snake.some((segment) => segment.x === candidate.x && segment.y === candidate.y));

    return candidate;
  }

  function setDirection(newDirection) {
    if (!directionMap[newDirection]) {
      return;
    }

    const current = directionMap[direction];
    const proposed = directionMap[newDirection];
    const wouldReverse = current.x + proposed.x === 0 && current.y + proposed.y === 0;

    if (snake.length > 1 && wouldReverse) {
      return;
    }

    nextDirection = newDirection;
  }

  function tick() {
    if (!gameRunning) {
      draw();
      return;
    }

    direction = nextDirection;
    const vector = directionMap[direction];
    const head = snake[0];
    const newHead = {
      x: wrapPosition(head.x + vector.x),
      y: wrapPosition(head.y + vector.y)
    };

    if (hitSelf(newHead)) {
      endGame();
      draw();
      return;
    }

    snake.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
      score += 10;

      if (score > highScore) {
        highScore = score;

        try {
          localStorage.setItem(storageKey, String(highScore));
        } catch (error) {
          // Keep gameplay running if browser storage is unavailable.
        }
      }

      food = spawnFood();
      updateScoreBoard();
    } else {
      snake.pop();
    }

    draw();
  }

  function wrapPosition(value) {
    if (value < 0) {
      return gridSize - 1;
    }

    if (value >= gridSize) {
      return 0;
    }

    return value;
  }

  function hitSelf(position) {
    return snake.some((segment) => segment.x === position.x && segment.y === position.y);
  }

  function endGame() {
    gameRunning = false;
    window.clearInterval(gameLoop);
  }

  function draw() {
    if (!cellSize || !snake || !food) {
      return;
    }

    const size = cellSize * gridSize;
    ctx.clearRect(0, 0, size, size);
    drawGrid();
    drawFood();
    drawSnake();

    if (!gameRunning) {
      drawGameOver();
    }
  }

  function drawGrid() {
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#181818" : "#222222";
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }

  function drawSnake() {
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? "#d0d0d0" : "#888888";
      ctx.fillRect(
        segment.x * cellSize + 2,
        segment.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
    });
  }

  function drawFood() {
    ctx.fillStyle = "#aaaaaa";
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      Math.max(3, cellSize * 0.32),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawGameOver() {
    const size = cellSize * gridSize;

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

  function handleKeydown(event) {
    const keyMap = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right"
    };

    if (keyMap[event.key]) {
      event.preventDefault();
      setDirection(keyMap[event.key]);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      resetGame();
    }
  }

  document.addEventListener("keydown", handleKeydown);
  restartButton.addEventListener("click", resetGame);
  document.querySelectorAll(".dpad-btn").forEach((button) => {
    const directionName = button.dataset.direction;

    button.addEventListener("touchstart", (event) => {
      event.preventDefault();
      setDirection(directionName);
    }, { passive: false });

    button.addEventListener("click", () => setDirection(directionName));
  });
  window.addEventListener("resize", resizeCanvas);
  window.setDirection = setDirection;

  highScore = loadHighScore();
  resizeCanvas();
  resetGame();
}());
