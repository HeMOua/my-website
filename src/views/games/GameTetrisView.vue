<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)

const COLS = 10
const ROWS = 20
const BLOCK_SIZE = 28
const CANVAS_WIDTH = COLS * BLOCK_SIZE
const CANVAS_HEIGHT = ROWS * BLOCK_SIZE
const PREVIEW_SIZE = 4 * BLOCK_SIZE

// 7 classic tetromino shapes
const SHAPES: number[][][] = [
  // I
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  // O
  [[1,1],[1,1]],
  // T
  [[0,1,0],[1,1,1],[0,0,0]],
  // S
  [[0,1,1],[1,1,0],[0,0,0]],
  // Z
  [[1,1,0],[0,1,1],[0,0,0]],
  // L
  [[0,0,1],[1,1,1],[0,0,0]],
  // J
  [[1,0,0],[1,1,1],[0,0,0]],
]

const COLORS = [
  '#00f0f0', // I - cyan
  '#f0f000', // O - yellow
  '#a000f0', // T - purple
  '#00f000', // S - green
  '#f00000', // Z - red
  '#f0a000', // L - orange
  '#0000f0', // J - blue
]

let board: number[][] = []
let currentPiece: { shape: number[][]; color: number; x: number; y: number } | null = null
let nextPieceIndex = -1
const score = ref(0)
const level = ref(1)
const lines = ref(0)
const gameOver = ref(false)
const paused = ref(false)
let dropInterval = 1000
let lastDrop = 0
let animFrameId = 0

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
}

function randomPieceIndex(): number {
  return Math.floor(Math.random() * SHAPES.length)
}

function createPiece(index: number) {
  const shape = SHAPES[index].map(row => [...row])
  return {
    shape,
    color: index,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  }
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length
  const cols = shape[0].length
  const rotated: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = shape[r][c]
    }
  }
  return rotated
}

function isValid(shape: number[][], px: number, py: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const nx = px + c
        const ny = py + r
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false
        if (ny >= 0 && board[ny][nx]) return false
      }
    }
  }
  return true
}

function lockPiece() {
  if (!currentPiece) return
  const { shape, color, x, y } = currentPiece
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const ny = y + r
        const nx = x + c
        if (ny < 0) {
          gameOver.value = true
          return
        }
        board[ny][nx] = color + 1
      }
    }
  }
  clearLines()
  spawnPiece()
}

function clearLines() {
  let cleared = 0
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== 0)) {
      board.splice(r, 1)
      board.unshift(new Array(COLS).fill(0))
      cleared++
      r++
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800]
    score.value += (points[cleared] || 800) * level.value
    lines.value += cleared
    level.value = Math.floor(lines.value / 10) + 1
    dropInterval = Math.max(100, 1000 - (level.value - 1) * 80)
  }
}

function spawnPiece() {
  if (nextPieceIndex < 0) nextPieceIndex = randomPieceIndex()
  currentPiece = createPiece(nextPieceIndex)
  nextPieceIndex = randomPieceIndex()

  if (!isValid(currentPiece.shape, currentPiece.x, currentPiece.y)) {
    gameOver.value = true
  }
}

function moveLeft() {
  if (!currentPiece || gameOver.value || paused.value) return
  if (isValid(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
    currentPiece.x--
  }
}

function moveRight() {
  if (!currentPiece || gameOver.value || paused.value) return
  if (isValid(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
    currentPiece.x++
  }
}

function moveDown(): boolean {
  if (!currentPiece || gameOver.value || paused.value) return false
  if (isValid(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y++
    return true
  }
  lockPiece()
  return false
}

function rotatePiece() {
  if (!currentPiece || gameOver.value || paused.value) return
  const rotated = rotate(currentPiece.shape)
  if (isValid(rotated, currentPiece.x, currentPiece.y)) {
    currentPiece.shape = rotated
  } else if (isValid(rotated, currentPiece.x - 1, currentPiece.y)) {
    currentPiece.shape = rotated
    currentPiece.x--
  } else if (isValid(rotated, currentPiece.x + 1, currentPiece.y)) {
    currentPiece.shape = rotated
    currentPiece.x++
  }
}

function hardDrop() {
  if (!currentPiece || gameOver.value || paused.value) return
  while (isValid(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y++
    score.value += 2
  }
  lockPiece()
}

function getGhostY(): number {
  if (!currentPiece) return 0
  let gy = currentPiece.y
  while (isValid(currentPiece.shape, currentPiece.x, gy + 1)) {
    gy++
  }
  return gy
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  isGhost = false
) {
  const px = x * BLOCK_SIZE
  const py = y * BLOCK_SIZE

  if (isGhost) {
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.3
    ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2)
    ctx.globalAlpha = 1
    return
  }

  ctx.fillStyle = color
  ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2)

  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, 3)
  ctx.fillRect(px + 1, py + 1, 3, BLOCK_SIZE - 2)

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(px + BLOCK_SIZE - 3, py + 1, 2, BLOCK_SIZE - 2)
  ctx.fillRect(px + 1, py + BLOCK_SIZE - 3, BLOCK_SIZE - 2, 2)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'
  ctx.lineWidth = 1
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * BLOCK_SIZE)
    ctx.lineTo(CANVAS_WIDTH, r * BLOCK_SIZE)
    ctx.stroke()
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * BLOCK_SIZE, 0)
    ctx.lineTo(c * BLOCK_SIZE, CANVAS_HEIGHT)
    ctx.stroke()
  }

  // Board
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        drawBlock(ctx, c, r, COLORS[board[r][c] - 1])
      }
    }
  }

  // Ghost piece
  if (currentPiece && !gameOver.value) {
    const ghostY = getGhostY()
    const color = COLORS[currentPiece.color]
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c]) {
          drawBlock(ctx, currentPiece.x + c, ghostY + r, color, true)
        }
      }
    }
  }

  // Current piece
  if (currentPiece && !gameOver.value) {
    const color = COLORS[currentPiece.color]
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c]) {
          drawBlock(ctx, currentPiece.x + c, currentPiece.y + r, color)
        }
      }
    }
  }

  // Game over overlay
  if (gameOver.value) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = '#ff4444'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('游戏结束', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '14px Arial'
    ctx.fillText('按 R 重新开始', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
  }

  // Paused overlay
  if (paused.value && !gameOver.value) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = 'cyan'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('暂停', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
  }
}

function drawPreview() {
  const previewCanvas = document.getElementById('tetris-preview-canvas') as HTMLCanvasElement
  if (!previewCanvas) return
  const ctx = previewCanvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)

  if (nextPieceIndex < 0) return
  const shape = SHAPES[nextPieceIndex]
  const color = COLORS[nextPieceIndex]
  const offsetX = (PREVIEW_SIZE - shape[0].length * BLOCK_SIZE) / 2
  const offsetY = (PREVIEW_SIZE - shape.length * BLOCK_SIZE) / 2

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const px = offsetX + c * BLOCK_SIZE
        const py = offsetY + r * BLOCK_SIZE
        ctx.fillStyle = color
        ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2)
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, 3)
        ctx.fillRect(px + 1, py + 1, 3, BLOCK_SIZE - 2)
      }
    }
  }
}

function gameLoop(timestamp: number) {
  if (!lastDrop) lastDrop = timestamp

  if (!gameOver.value && !paused.value) {
    if (timestamp - lastDrop > dropInterval) {
      moveDown()
      lastDrop = timestamp
    }
  }

  draw()
  drawPreview()
  animFrameId = requestAnimationFrame(gameLoop)
}

function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      moveLeft()
      break
    case 'ArrowRight':
      e.preventDefault()
      moveRight()
      break
    case 'ArrowDown':
      e.preventDefault()
      moveDown()
      score.value += 1
      break
    case 'ArrowUp':
      e.preventDefault()
      rotatePiece()
      break
    case ' ':
      e.preventDefault()
      hardDrop()
      break
    case 'p':
    case 'P':
      paused.value = !paused.value
      break
    case 'r':
    case 'R':
      if (gameOver.value) restart()
      break
  }
}

function restart() {
  board = createBoard()
  score.value = 0
  level.value = 1
  lines.value = 0
  gameOver.value = false
  paused.value = false
  dropInterval = 1000
  lastDrop = 0
  nextPieceIndex = -1
  currentPiece = null
  spawnPiece()
}

onMounted(() => {
  board = createBoard()
  spawnPiece()
  window.addEventListener('keydown', handleKeydown)
  animFrameId = requestAnimationFrame(gameLoop)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  cancelAnimationFrame(animFrameId)
})
</script>

<template>
  <div class="game-tetris">
    <header class="game-header">
      <router-link to="/games" class="back">&larr; 返回游戏列表</router-link>
      <h1>俄罗斯方块</h1>
    </header>

    <div class="game-content">
      <div class="game-area">
        <canvas
          ref="canvasRef"
          :width="CANVAS_WIDTH"
          :height="CANVAS_HEIGHT"
          class="game-canvas"
        ></canvas>

        <div class="side-panel">
          <div class="panel-section">
            <h3>下一个</h3>
            <canvas
              id="tetris-preview-canvas"
              :width="PREVIEW_SIZE"
              :height="PREVIEW_SIZE"
              class="preview-canvas"
            ></canvas>
          </div>

          <div class="panel-section">
            <h3>分数</h3>
            <div class="value">{{ score }}</div>
          </div>

          <div class="panel-section">
            <h3>等级</h3>
            <div class="value">{{ level }}</div>
          </div>

          <div class="panel-section">
            <h3>消行</h3>
            <div class="value">{{ lines }}</div>
          </div>

          <button class="restart-btn" @click="restart">重新开始</button>
          <button class="pause-btn" @click="paused = !paused">
            {{ paused ? '继续' : '暂停' }}
          </button>
        </div>
      </div>

      <div class="controls-info">
        <kbd>&larr;</kbd><kbd>&rarr;</kbd> 移动 &nbsp;
        <kbd>&uarr;</kbd> 旋转 &nbsp;
        <kbd>&darr;</kbd> 加速 &nbsp;
        <kbd>Space</kbd> 硬降 &nbsp;
        <kbd>P</kbd> 暂停
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-tetris {
  min-height: 100vh;
  padding: 32px 40px;
  background: #0a0a0a;
}

.game-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
}

.back {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.back:hover {
  opacity: 1;
}

h1 {
  font-size: 32px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan;
}

.game-content {
  max-width: 700px;
  margin: 0 auto;
}

.game-area {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.game-canvas {
  border: 2px solid rgba(0, 255, 255, 0.3);
  border-radius: 4px;
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.1);
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 140px;
}

.panel-section {
  background: rgba(0, 255, 255, 0.05);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.panel-section h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(0, 255, 255, 0.6);
  margin-bottom: 8px;
}

.panel-section .value {
  font-size: 24px;
  font-weight: bold;
  color: #edcf72;
}

.preview-canvas {
  border-radius: 4px;
  display: block;
  margin: 0 auto;
}

.restart-btn,
.pause-btn {
  padding: 10px 16px;
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.3);
  color: cyan;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
  width: 100%;
}

.restart-btn:hover,
.pause-btn:hover {
  background: rgba(0, 255, 255, 0.25);
  border-color: rgba(0, 255, 255, 0.6);
}

.controls-info {
  margin-top: 24px;
  text-align: center;
  font-size: 13px;
  opacity: 0.5;
}

kbd {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  margin: 0 2px;
}
</style>
