let draggedWindow = null;
let offsetX = 0;
let offsetY = 0;
let zIndex = 1000;

document.addEventListener('DOMContentLoaded', function() {
  initializePage();
});

function initializePage() {
  updateClock();
  setInterval(updateClock, 1000);
  setupTouchHandlers();
}

function dismissLogin() {
  const overlay = document.getElementById('xpLogin');
  const audio = document.getElementById('xpStartupSound');
  if (audio) {
    audio.play().catch(() => {});
  }
  if (overlay) {
    overlay.classList.add('dismissed');
    setTimeout(() => overlay.remove(), 700);
  }
}

function setupTouchHandlers() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  document.querySelectorAll('[ondblclick]').forEach(el => {
    const handler = el.getAttribute('ondblclick');
    el.removeAttribute('ondblclick');
    el.setAttribute('onclick', handler);
  });
}

function openMediaPlayer() {
  openWindow('mediaPlayer');
  const audio = document.getElementById('wmpAudio');
  if (!audio) return;
  setupMediaPlayer();
  audio.currentTime = 0;
  audio.play().catch(() => {});
  updatePlayButton();
}

function closeMediaPlayer() {
  const audio = document.getElementById('wmpAudio');
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  updatePlayButton();
  closeWindow('mediaPlayer');
}

function toggleMediaPlayback() {
  const audio = document.getElementById('wmpAudio');
  if (!audio) return;
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
  updatePlayButton();
}

function updatePlayButton() {
  const audio = document.getElementById('wmpAudio');
  const btn = document.getElementById('wmpPlayBtn');
  const viz = document.getElementById('wmpVisualizer');
  if (!audio || !btn) return;
  if (audio.paused) {
    btn.innerHTML = '&#9654;';
    if (viz) viz.classList.add('paused');
  } else {
    btn.innerHTML = '&#10073;&#10073;';
    if (viz) viz.classList.remove('paused');
  }
}

function seekMedia(e) {
  const audio = document.getElementById('wmpAudio');
  const bar = document.getElementById('wmpProgress');
  if (!audio || !bar || !audio.duration) return;
  const rect = bar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
}

function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

let wmpInitialized = false;
function setupMediaPlayer() {
  if (wmpInitialized) return;
  const audio = document.getElementById('wmpAudio');
  if (!audio) return;
  audio.addEventListener('timeupdate', () => {
    const fill = document.getElementById('wmpProgressFill');
    const cur = document.getElementById('wmpTimeCurrent');
    if (fill && audio.duration) {
      fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
    }
    if (cur) cur.textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => {
    const total = document.getElementById('wmpTimeTotal');
    if (total) total.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    updatePlayButton();
  });
  audio.addEventListener('play', updatePlayButton);
  audio.addEventListener('pause', updatePlayButton);
  wmpInitialized = true;
}

function openTotse() {
  window.open('https://web.archive.org/web/20050831122910/http://www.totse.com/en/hack/index.html', '_blank');
}

// Minesweeper Logic
let mineGrid = [];
let mineRevealed = [];
let mineFlagged = [];
const GRID_SIZE = 8;
const MINE_COUNT = 10;

function initMinesweeper() {
  mineGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
  mineRevealed = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
  mineFlagged = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));

  let minesPlaced = 0;
  while (minesPlaced < MINE_COUNT) {
    const row = Math.floor(Math.random() * GRID_SIZE);
    const col = Math.floor(Math.random() * GRID_SIZE);
    if (mineGrid[row][col] !== -1) {
      mineGrid[row][col] = -1;
      minesPlaced++;
    }
  }

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (mineGrid[row][col] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && mineGrid[nr][nc] === -1) {
            count++;
          }
        }
      }
      mineGrid[row][col] = count;
    }
  }

  renderMinesweeper();
}

function renderMinesweeper() {
  const board = document.getElementById('mineBoard');
  if (!board) return;

  board.innerHTML = '';

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = 'mine-cell';

      if (mineRevealed[row][col]) {
        cell.classList.add('revealed');
        if (mineGrid[row][col] === -1) {
          cell.textContent = '💣';
          cell.classList.add('mine');
        } else if (mineGrid[row][col] > 0) {
          cell.textContent = mineGrid[row][col];
          const colors = ['', '#0000FF', '#008000', '#FF0000', '#000080', '#800000', '#008080', '#000000', '#808080'];
          cell.style.color = colors[mineGrid[row][col]];
        }
      } else if (mineFlagged[row][col]) {
        cell.classList.add('flagged');
      }

      cell.onclick = () => revealCell(row, col);
      cell.oncontextmenu = (e) => {
        e.preventDefault();
        toggleFlag(row, col);
      };

      board.appendChild(cell);
    }
  }

  const flagCount = mineFlagged.flat().filter(f => f).length;
  const mineCountEl = document.getElementById('mineCount');
  if (mineCountEl) mineCountEl.textContent = MINE_COUNT - flagCount;
}

function revealCell(row, col) {
  if (mineRevealed[row][col] || mineFlagged[row][col]) return;

  mineRevealed[row][col] = true;

  if (mineGrid[row][col] === -1) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (mineGrid[r][c] === -1) {
          mineRevealed[r][c] = true;
        }
      }
    }
    renderMinesweeper();
    setTimeout(() => alert('Game Over! You hit a mine!'), 100);
    return;
  }

  if (mineGrid[row][col] === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          revealCell(nr, nc);
        }
      }
    }
  }

  renderMinesweeper();
  checkWin();
}

function toggleFlag(row, col) {
  if (mineRevealed[row][col]) return;
  mineFlagged[row][col] = !mineFlagged[row][col];
  renderMinesweeper();
}

function checkWin() {
  let allSafe = true;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (mineGrid[row][col] !== -1 && !mineRevealed[row][col]) {
        allSafe = false;
      }
    }
  }

  if (allSafe) {
    setTimeout(() => alert('Congratulations! You won!'), 100);
  }
}

// SkiFree Game Logic
let gameRunning = false;
let player = { x: 200, y: 50, vx: 0, vy: 0 };
let obstacles = [];
let distance = 0;
let gameSpeed = 2;

function initGame() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  player = { x: 200, y: 50, vx: 0, vy: 2 };
  obstacles = [];
  distance = 0;
  gameSpeed = 2;
  gameRunning = true;

  const gameOverEl = document.getElementById('gameOver');
  if (gameOverEl) gameOverEl.classList.remove('active');

  for (let i = 0; i < 10; i++) {
    obstacles.push({
      x: Math.random() * 350 + 25,
      y: i * 100 + 200,
      type: Math.random() > 0.5 ? 'tree' : 'rock'
    });
  }

  setupSkifreeTouchControls();
}

function setupSkifreeTouchControls() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas || canvas.dataset.touchInit === '1') return;

  const onMove = (e) => {
    if (!gameRunning) return;
    e.preventDefault();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    player.vx = (x < rect.width / 2) ? -4 : 4;
  };

  const onEnd = (e) => {
    e.preventDefault();
    player.vx = 0;
  };

  canvas.addEventListener('touchstart', onMove, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd, { passive: false });
  canvas.addEventListener('touchcancel', onEnd, { passive: false });
  canvas.dataset.touchInit = '1';
}

function drawPlayer(ctx) {
  if (!ctx) return;
  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x - 8, player.y + 20);
  ctx.lineTo(player.x + 8, player.y + 20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(player.x, player.y - 5, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawObstacle(ctx, obs) {
  if (!ctx) return;
  if (obs.type === 'tree') {
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y - 15);
    ctx.lineTo(obs.x - 10, obs.y + 5);
    ctx.lineTo(obs.x + 10, obs.y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#8B4513';
    ctx.fillRect(obs.x - 3, obs.y + 5, 6, 10);
  } else {
    ctx.fillStyle = '#696969';
    ctx.beginPath();
    ctx.arc(obs.x, obs.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function checkCollision(obs) {
  const dx = player.x - obs.x;
  const dy = player.y - obs.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < 15;
}

function gameLoop() {
  if (!gameRunning) return;

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  player.x += player.vx;
  player.y = 50;

  if (player.x < 10) player.x = 10;
  if (player.x > 390) player.x = 390;

  obstacles.forEach((obs, index) => {
    obs.y -= gameSpeed;

    if (obs.y < -20) {
      obstacles[index] = {
        x: Math.random() * 350 + 25,
        y: canvas.height + 20,
        type: Math.random() > 0.5 ? 'tree' : 'rock'
      };
    }

    if (checkCollision(obs)) {
      gameRunning = false;
      const gameOverEl = document.getElementById('gameOver');
      const finalDistanceEl = document.getElementById('finalDistance');
      if (gameOverEl) gameOverEl.classList.add('active');
      if (finalDistanceEl) finalDistanceEl.textContent = Math.floor(distance);
    }

    drawObstacle(ctx, obs);
  });

  drawPlayer(ctx);

  distance += gameSpeed * 0.1;
  gameSpeed += 0.001;

  const distanceEl = document.getElementById('distance');
  const speedEl = document.getElementById('speed');
  if (distanceEl) distanceEl.textContent = Math.floor(distance);
  if (speedEl) speedEl.textContent = Math.floor(gameSpeed);

  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
  if (!gameRunning) return;

  if (e.key === 'ArrowLeft') {
    player.vx = -4;
  } else if (e.key === 'ArrowRight') {
    player.vx = 4;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    player.vx = 0;
  }
});

function restartGame() {
  initGame();
  gameLoop();
}

// Window Management
function openWindow(windowId) {
  const win = document.getElementById(windowId);
  if (!win) return;

  win.classList.add('active');
  win.style.zIndex = ++zIndex;
  updateTaskbar();

  if (windowId === 'skifree' && !gameRunning) {
    setTimeout(() => {
      initGame();
      gameLoop();
    }, 100);
  }

  if (windowId === 'minesweeper') {
    setTimeout(() => initMinesweeper(), 100);
  }
}

function closeWindow(windowId) {
  const win = document.getElementById(windowId);
  if (!win) return;

  win.classList.remove('active');
  updateTaskbar();

  if (windowId === 'skifree') {
    gameRunning = false;
  }
}

function startDrag(e, windowId) {
  if (window.innerWidth <= 768) return;
  draggedWindow = document.getElementById(windowId);
  if (!draggedWindow) return;

  draggedWindow.style.zIndex = ++zIndex;
  const rect = draggedWindow.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
  if (draggedWindow) {
    draggedWindow.style.left = (e.clientX - offsetX) + 'px';
    draggedWindow.style.top = (e.clientY - offsetY) + 'px';
  }
}

function stopDrag() {
  draggedWindow = null;
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
}

function updateTaskbar() {
  const taskbarItems = document.getElementById('taskbarItems');
  if (!taskbarItems) return;

  taskbarItems.innerHTML = '';
  const windows = document.querySelectorAll('.window.active');
  windows.forEach(win => {
    const item = document.createElement('div');
    item.className = 'taskbar-item';
    const titleEl = win.querySelector('.title-text span:last-child');
    const title = titleEl ? titleEl.textContent : 'Window';
    item.textContent = title;
    item.onclick = () => {
      win.style.zIndex = ++zIndex;
    };
    taskbarItems.appendChild(item);
  });
}

function toggleStartMenu() {
  const menu = document.getElementById('startMenu');
  if (!menu) return;
  menu.classList.toggle('active');
}

function updateClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;

  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  clockEl.textContent = `🕐 ${hours}:${minutes}`;
}

document.addEventListener('click', (e) => {
  const startMenu = document.getElementById('startMenu');
  const startBtn = document.querySelector('.start-btn');
  if (startMenu && startBtn && !startMenu.contains(e.target) && !startBtn.contains(e.target)) {
    startMenu.classList.remove('active');
  }
});
