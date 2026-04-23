<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'

const boardCanvasRef = ref<HTMLCanvasElement | null>(null)
const nextCanvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const level = ref(1)
const lines = ref(0)
const gameState = ref<'idle' | 'playing' | 'paused' | 'over'>('idle')

const COLS = 10
const ROWS = 20
const CELL = 30
const BOARD_W = COLS * CELL
const BOARD_H = ROWS * CELL
const NEXT_SIZE = 120

type CellValue = 0 | string
type Board = CellValue[][]

const PIECE_COLORS: Record<string, string> = {
  I: '#00ffff',
  O: '#ffff00',
  T: '#aa00ff',
  S: '#00ff00',
  Z: '#ff0000',
  J: '#0000ff',
  L: '#ff8800',
}

interface Shape {
  matrix: number[][]
  type: string
}

const SHAPES: Shape[] = [
  { type: 'I', matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  { type: 'O', matrix: [[1,1],[1,1]] },
  { type: 'T', matrix: [[0,1,0],[1,1,1],[0,0,0]] },
  { type: 'S', matrix: [[0,1,1],[1,1,0],[0,0,0]] },
  { type: 'Z', matrix: [[1,1,0],[0,1,1],[0,0,0]] },
  { type: 'J', matrix: [[1,0,0],[1,1,1],[0,0,0]] },
  { type: 'L', matrix: [[0,0,1],[1,1,1],[0,0,0]] },
]

let boardCtx: CanvasRenderingContext2D
let nextCtx: CanvasRenderingContext2D
let board: Board = []
let currentPiece: { shape: Shape; x: number; y: number } | null = null
let nextPiece: Shape | null = null
let timer: number = 0
let bag: Shape[] = []

const speed = computed(() => {
  return Math.max(100, 800 - (level.value - 1) * 70)
})

onMounted(() => {
  boardCtx = boardCanvasRef.value!.getContext('2d')!
  nextCtx = nextCanvasRef.value!.getContext('2d')!
  drawIdle()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKey)
})

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as CellValue[])
}

function shuffleBag(): Shape[] {
  const arr = [...SHAPES]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function getNextShape(): Shape {
  if (bag.length === 0) {
    bag = shuffleBag()
  }
  return bag.pop()!
}

function spawnPiece(shape: Shape): { shape: Shape; x: number; y: number } {
  return {
    shape,
    x: Math.floor((COLS - shape.matrix[0].length) / 2),
    y: 0,
  }
}

function rotateMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const rotated: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = matrix[r][c]
    }
  }
  return rotated
}

function isValid(shape: Shape, px: number, py: number): boolean {
  const m = shape.matrix
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) {
        const nx = px + c
        const ny = py + r
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false
        if (ny >= 0 && board[ny][nx] !== 0) return false
      }
    }
  }
  return true
}

function lockPiece() {
  if (!currentPiece) return
  const m = currentPiece.shape.matrix
  const color = PIECE_COLORS[currentPiece.shape.type]
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) {
        const ny = currentPiece.y + r
        const nx = currentPiece.x + c
        if (ny < 0) {
          gameOver()
          return
        }
        board[ny][nx] = color
      }
    }
  }
  clearLines()
  nextTurn()
}

function clearLines() {
  let cleared = 0
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== 0)) {
      board.splice(r, 1)
      board.unshift(Array(COLS).fill(0) as CellValue[])
      cleared++
      r++ // re-check same row index
    }
  }
  if (cleared > 0) {
    const scoreTable: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 }
    score.value += (scoreTable[cleared] || 0) * level.value
    lines.value += cleared
    level.value = Math.floor(lines.value / 10) + 1
    restartTimer()
  }
}

function nextTurn() {
  currentPiece = spawnPiece(nextPiece!)
  nextPiece = getNextShape()
  if (!isValid(currentPiece.shape, currentPiece.x, currentPiece.y)) {
    gameOver()
  }
}

function getGhostY(): number {
  if (!currentPiece) return 0
  let gy = currentPiece.y
  while (isValid(currentPiece.shape, currentPiece.x, gy + 1)) {
    gy++
  }
  return gy
}

function hardDrop() {
  if (!currentPiece) return
  const ghostY = getGhostY()
  score.value += (ghostY - currentPiece.y) * 2
  currentPiece.y = ghostY
  lockPiece()
  draw()
}

function moveLeft() {
  if (!currentPiece) return
  if (isValid(currentPiece.shape, currentPiece.x - 1, currentPiece.y)) {
    currentPiece.x--
    draw()
  }
}

function moveRight() {
  if (!currentPiece) return
  if (isValid(currentPiece.shape, currentPiece.x + 1, currentPiece.y)) {
    currentPiece.x++
    draw()
  }
}

function softDrop() {
  if (!currentPiece) return
  if (isValid(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y++
    score.value += 1
    draw()
  }
}

function rotate() {
  if (!currentPiece) return
  const rotated: Shape = {
    type: currentPiece.shape.type,
    matrix: rotateMatrix(currentPiece.shape.matrix),
  }
  // Try normal rotation
  if (isValid(rotated, currentPiece.x, currentPiece.y)) {
    currentPiece.shape = rotated
    draw()
    return
  }
  // Wall kick: try shifting left/right
  const kicks = [1, -1, 2, -2]
  for (const kick of kicks) {
    if (isValid(rotated, currentPiece.x + kick, currentPiece.y)) {
      currentPiece.shape = rotated
      currentPiece.x += kick
      draw()
      return
    }
  }
}

function tick() {
  if (!currentPiece) return
  if (isValid(currentPiece.shape, currentPiece.x, currentPiece.y + 1)) {
    currentPiece.y++
  } else {
    lockPiece()
  }
  draw()
}

function restartTimer() {
  clearInterval(timer)
  timer = window.setInterval(tick, speed.value)
}

function start() {
  board = createBoard()
  bag = shuffleBag()
  score.value = 0
  level.value = 1
  lines.value = 0
  gameState.value = 'playing'

  nextPiece = getNextShape()
  currentPiece = spawnPiece(getNextShape())
  nextPiece = getNextShape()

  restartTimer()
  draw()
}

function restart() {
  start()
}

function togglePause() {
  if (gameState.value === 'playing') {
    gameState.value = 'paused'
    clearInterval(timer)
    drawPause()
  } else if (gameState.value === 'paused') {
    gameState.value = 'playing'
    restartTimer()
  }
}

function gameOver() {
  clearInterval(timer)
  gameState.value = 'over'
  draw()
  // Draw game over overlay
  boardCtx.fillStyle = 'rgba(0,0,0,0.65)'
  boardCtx.fillRect(0, 0, BOARD_W, BOARD_H)
  boardCtx.fillStyle = '#ff4444'
  boardCtx.font = 'bold 32px Arial'
  boardCtx.textAlign = 'center'
  boardCtx.fillText('GAME OVER', BOARD_W / 2, BOARD_H / 2 - 20)
  boardCtx.fillStyle = '#ffffff'
  boardCtx.font = '18px Arial'
  boardCtx.fillText(`Score: ${score.value}`, BOARD_W / 2, BOARD_H / 2 + 20)
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  cellSize: number,
  ghost = false
) {
  const px = x * cellSize
  const py = y * cellSize
  if (ghost) {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.3
    ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2)
    ctx.globalAlpha = 1
    return
  }
  // Main fill
  ctx.fillStyle = color
  ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2)
  // Highlight (top-left)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(px + 1, py + 1, cellSize - 2, 3)
  ctx.fillRect(px + 1, py + 1, 3, cellSize - 2)
  // Shadow (bottom-right)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(px + 1, py + cellSize - 4, cellSize - 2, 3)
  ctx.fillRect(px + cellSize - 4, py + 1, 3, cellSize - 2)
}

function draw() {
  // Board background
  boardCtx.fillStyle = '#0a0a0a'
  boardCtx.fillRect(0, 0, BOARD_W, BOARD_H)

  // Grid lines
  boardCtx.strokeStyle = 'rgba(255,255,255,0.03)'
  boardCtx.lineWidth = 0.5
  for (let x = 0; x <= COLS; x++) {
    boardCtx.beginPath()
    boardCtx.moveTo(x * CELL, 0)
    boardCtx.lineTo(x * CELL, BOARD_H)
    boardCtx.stroke()
  }
  for (let y = 0; y <= ROWS; y++) {
    boardCtx.beginPath()
    boardCtx.moveTo(0, y * CELL)
    boardCtx.lineTo(BOARD_W, y * CELL)
    boardCtx.stroke()
  }

  // Locked cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== 0) {
        drawCell(boardCtx, c, r, board[r][c] as string, CELL)
      }
    }
  }

  // Ghost piece
  if (currentPiece && gameState.value === 'playing') {
    const ghostY = getGhostY()
    if (ghostY !== currentPiece.y) {
      const m = currentPiece.shape.matrix
      const color = PIECE_COLORS[currentPiece.shape.type]
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c]) {
            const ny = ghostY + r
            if (ny >= 0) {
              drawCell(boardCtx, currentPiece.x + c, ny, color, CELL, true)
            }
          }
        }
      }
    }
  }

  // Current piece
  if (currentPiece) {
    const m = currentPiece.shape.matrix
    const color = PIECE_COLORS[currentPiece.shape.type]
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) {
          const ny = currentPiece.y + r
          if (ny >= 0) {
            drawCell(boardCtx, currentPiece.x + c, ny, color, CELL)
          }
        }
      }
    }
  }

  // Next piece preview
  drawNext()
}

function drawNext() {
  nextCtx.fillStyle = '#0a0a0a'
  nextCtx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE)

  if (!nextPiece) return

  const m = nextPiece.matrix
  const color = PIECE_COLORS[nextPiece.type]
  const previewCell = 24
  const offsetX = (NEXT_SIZE - m[0].length * previewCell) / 2
  const offsetY = (NEXT_SIZE - m.length * previewCell) / 2

  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (m[r][c]) {
        const px = offsetX + c * previewCell
        const py = offsetY + r * previewCell
        // Main fill
        nextCtx.fillStyle = color
        nextCtx.fillRect(px + 1, py + 1, previewCell - 2, previewCell - 2)
        // Highlight
        nextCtx.fillStyle = 'rgba(255,255,255,0.25)'
        nextCtx.fillRect(px + 1, py + 1, previewCell - 2, 3)
        nextCtx.fillRect(px + 1, py + 1, 3, previewCell - 2)
        // Shadow
        nextCtx.fillStyle = 'rgba(0,0,0,0.25)'
        nextCtx.fillRect(px + 1, py + previewCell - 4, previewCell - 2, 3)
        nextCtx.fillRect(px + previewCell - 4, py + 1, 3, previewCell - 2)
      }
    }
  }
}

function drawIdle() {
  boardCtx.fillStyle = '#0a0a0a'
  boardCtx.fillRect(0, 0, BOARD_W, BOARD_H)
  boardCtx.fillStyle = '#00ffff'
  boardCtx.font = 'bold 36px Arial'
  boardCtx.textAlign = 'center'
  boardCtx.fillText('TETRIS', BOARD_W / 2, BOARD_H / 2 - 30)
  boardCtx.fillStyle = 'rgba(255,255,255,0.5)'
  boardCtx.font = '15px Arial'
  boardCtx.fillText('Press Space or click Start', BOARD_W / 2, BOARD_H / 2 + 15)
  boardCtx.fillText('Arrow keys to play', BOARD_W / 2, BOARD_H / 2 + 40)

  nextCtx.fillStyle = '#0a0a0a'
  nextCtx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE)
}

function drawPause() {
  boardCtx.fillStyle = 'rgba(0,0,0,0.55)'
  boardCtx.fillRect(0, 0, BOARD_W, BOARD_H)
  boardCtx.fillStyle = '#ffff00'
  boardCtx.font = 'bold 30px Arial'
  boardCtx.textAlign = 'center'
  boardCtx.fillText('PAUSED', BOARD_W / 2, BOARD_H / 2)
  boardCtx.fillStyle = 'rgba(255,255,255,0.5)'
  boardCtx.font = '15px Arial'
  boardCtx.fillText('Press Space to resume', BOARD_W / 2, BOARD_H / 2 + 35)
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value === 'idle' || gameState.value === 'over') {
      start()
    } else {
      togglePause()
    }
    return
  }

  if (gameState.value !== 'playing') return

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
      softDrop()
      break
    case 'ArrowUp':
      e.preventDefault()
      rotate()
      break
    default:
      break
  }
}
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back">&larr; Back to Games</router-link>
      <h1>Tetris</h1>
    </header>

    <div class="game-body">
      <div class="board-wrap">
        <canvas ref="boardCanvasRef" :width="BOARD_W" :height="BOARD_H" />
      </div>

      <div class="side-panel">
        <div class="panel-section">
          <div class="panel-label">NEXT</div>
          <div class="next-wrap">
            <canvas ref="nextCanvasRef" :width="NEXT_SIZE" :height="NEXT_SIZE" />
          </div>
        </div>

        <div class="panel-section">
          <div class="panel-label">SCORE</div>
          <div class="panel-value">{{ score }}</div>
        </div>

        <div class="panel-section">
          <div class="panel-label">LEVEL</div>
          <div class="panel-value">{{ level }}</div>
        </div>

        <div class="panel-section">
          <div class="panel-label">LINES</div>
          <div class="panel-value">{{ lines }}</div>
        </div>

        <div class="panel-section controls-section">
          <div class="panel-label">CONTROLS</div>
          <div class="controls-list">
            <p><kbd>&larr;</kbd> <kbd>&rarr;</kbd> Move</p>
            <p><kbd>&uarr;</kbd> Rotate</p>
            <p><kbd>&darr;</kbd> Soft Drop</p>
            <p><kbd>Space</kbd> Hard Drop</p>
          </div>
        </div>

        <div class="btn-group">
          <button v-if="gameState === 'idle'" class="btn" @click="start">Start</button>
          <button v-if="gameState === 'playing'" class="btn" @click="togglePause">Pause</button>
          <button v-if="gameState === 'paused'" class="btn" @click="togglePause">Resume</button>
          <button v-if="gameState === 'over'" class="btn" @click="restart">Restart</button>
        </div>
      </div>
    </div>

    <div class="controls-hint">
      <span v-if="gameState === 'idle'">Space to start | Arrow keys to play</span>
      <span v-else-if="gameState === 'playing'">Left/Right: Move | Up: Rotate | Down: Soft Drop | Space: Hard Drop</span>
      <span v-else-if="gameState === 'paused'">Paused | Space to resume</span>
      <span v-else>Game Over | Space to restart</span>
    </div>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0a0a0a;
  padding: 20px;
  color: #ccc;
  font-family: Arial, sans-serif;
}

.game-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 500px;
}

.back {
  color: #00ffff;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  white-space: nowrap;
}

.back:hover {
  opacity: 1;
}

h1 {
  font-size: 24px;
  color: #00ffff;
  text-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
  flex: 1;
  margin: 0;
}

.game-body {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.board-wrap {
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  line-height: 0;
}

.board-wrap canvas {
  display: block;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 140px;
}

.panel-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 10px 14px;
}

.panel-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(0, 255, 255, 0.7);
  margin-bottom: 6px;
}

.panel-value {
  font-size: 22px;
  font-weight: bold;
  color: #00ffff;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.next-wrap {
  display: flex;
  justify-content: center;
}

.next-wrap canvas {
  display: block;
  border-radius: 4px;
}

.controls-section .controls-list {
  font-size: 12px;
  color: #888;
  line-height: 1.8;
  margin: 0;
}

.controls-section .controls-list p {
  margin: 0;
}

.controls-section kbd {
  display: inline-block;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  color: #00ffff;
  font-family: 'Courier New', Courier, monospace;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  background: rgba(0, 255, 255, 0.12);
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.35);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  font-weight: bold;
  letter-spacing: 1px;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.22);
  border-color: rgba(0, 255, 255, 0.6);
}

.controls-hint {
  margin-top: 16px;
  font-size: 12px;
  opacity: 0.4;
  text-align: center;
}
</style>
