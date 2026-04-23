<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

// ========== 游戏常量 ==========
const GRID = 20
const COLS = 24
const ROWS = 24
const W = COLS * GRID
const H = ROWS * GRID

// ========== 游戏状态 ==========
const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const bestScore = ref(0)
const gameState = ref<'idle' | 'playing' | 'paused' | 'over'>('idle')
const currentSpeed = ref(120)

let ctx: CanvasRenderingContext2D
let snake: { x: number; y: number }[] = []
let dir = { x: 1, y: 0 }
let nextDir = { x: 1, y: 0 }
let food = { x: 0, y: 0 }
let timer: number
let speed = 120
let foodPulse = 0
let animFrame: number

// ========== 分数管理 ==========
function loadBest() {
  bestScore.value = Number(localStorage.getItem('snake-best') || 0)
}

function saveBest() {
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('snake-best', String(bestScore.value))
  }
}

// ========== 游戏控制 ==========
function start() {
  snake = [
    { x: 5, y: 12 },
    { x: 4, y: 12 },
    { x: 3, y: 12 },
  ]
  dir = { x: 1, y: 0 }
  nextDir = { x: 1, y: 0 }
  score.value = 0
  speed = 120
  currentSpeed.value = speed
  gameState.value = 'playing'
  placeFood()
  clearInterval(timer)
  timer = window.setInterval(tick, speed)
}

function togglePause() {
  if (gameState.value === 'playing') {
    clearInterval(timer)
    gameState.value = 'paused'
    drawPauseOverlay()
  } else if (gameState.value === 'paused') {
    gameState.value = 'playing'
    timer = window.setInterval(tick, speed)
  }
}

function placeFood() {
  let pos: { x: number; y: number }
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  food = pos
}

// ========== 游戏逻辑 ==========
function tick() {
  dir = { ...nextDir }
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }

  // 碰墙
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    gameOver()
    return
  }

  // 碰自己
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver()
    return
  }

  snake.unshift(head)

  if (head.x === food.x && head.y === food.y) {
    score.value += 10
    placeFood()
    // 加速：速度随分数逐渐加快
    if (speed > 50) {
      speed = Math.max(50, 120 - Math.floor(score.value / 30) * 5)
      currentSpeed.value = speed
      clearInterval(timer)
      timer = window.setInterval(tick, speed)
    }
  } else {
    snake.pop()
  }

  draw()
}

function gameOver() {
  clearInterval(timer)
  gameState.value = 'over'
  saveBest()
  draw()
  drawGameOverOverlay()
}

// ========== 绘制函数 ==========
function draw() {
  if (!ctx) return

  // 背景
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // 网格线
  drawGrid()

  // 食物
  drawFood()

  // 蛇身
  drawSnake()
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)'
  ctx.lineWidth = 0.5
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath()
    ctx.moveTo(x * GRID, 0)
    ctx.lineTo(x * GRID, H)
    ctx.stroke()
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * GRID)
    ctx.lineTo(W, y * GRID)
    ctx.stroke()
  }
}

function drawFood() {
  foodPulse += 0.08
  const pulse = Math.sin(foodPulse) * 0.3 + 0.7
  const cx = food.x * GRID + GRID / 2
  const cy = food.y * GRID + GRID / 2
  const baseRadius = GRID / 2 - 2

  // 外发光
  const glowRadius = baseRadius + 6 * pulse
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
  gradient.addColorStop(0, 'rgba(255, 50, 50, 0.6)')
  gradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.15)')
  gradient.addColorStop(1, 'rgba(255, 50, 50, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()

  // 食物本体
  ctx.fillStyle = '#ff4444'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 12 * pulse
  ctx.beginPath()
  ctx.arc(cx, cy, baseRadius * (0.85 + 0.15 * pulse), 0, Math.PI * 2)
  ctx.fill()

  // 高光
  ctx.fillStyle = 'rgba(255, 150, 150, 0.5)'
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(cx - 2, cy - 2, baseRadius * 0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowBlur = 0
}

function drawSnake() {
  const len = snake.length

  snake.forEach((seg, i) => {
    const ratio = 1 - i / len
    const x = seg.x * GRID
    const y = seg.y * GRID
    const pad = i === 0 ? 1 : 2
    const w = GRID - pad * 2
    const h = GRID - pad * 2

    // 渐变色：头部青色，尾部深蓝
    const r = Math.round(0 + 20 * (1 - ratio))
    const g = Math.round(255 * ratio + 100 * (1 - ratio))
    const b = Math.round(255 * ratio + 180 * (1 - ratio))

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`

    // 蛇头发光
    if (i === 0) {
      ctx.shadowColor = 'cyan'
      ctx.shadowBlur = 10
    } else {
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.3)`
      ctx.shadowBlur = 3
    }

    // 圆角矩形
    const radius = i === 0 ? 5 : 3
    drawRoundRect(x + pad, y + pad, w, h, radius)
    ctx.fill()

    // 蛇头眼睛
    if (i === 0) {
      ctx.shadowBlur = 0
      drawEyes(seg)
    }
  })

  ctx.shadowBlur = 0
}

function drawRoundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawEyes(head: { x: number; y: number }) {
  const cx = head.x * GRID + GRID / 2
  const cy = head.y * GRID + GRID / 2
  const eyeOffset = 4
  const eyeRadius = 2.5

  let e1x: number, e1y: number, e2x: number, e2y: number

  if (dir.x === 1) {
    e1x = cx + 3; e1y = cy - eyeOffset
    e2x = cx + 3; e2y = cy + eyeOffset
  } else if (dir.x === -1) {
    e1x = cx - 3; e1y = cy - eyeOffset
    e2x = cx - 3; e2y = cy + eyeOffset
  } else if (dir.y === -1) {
    e1x = cx - eyeOffset; e1y = cy - 3
    e2x = cx + eyeOffset; e2y = cy - 3
  } else {
    e1x = cx - eyeOffset; e1y = cy + 3
    e2x = cx + eyeOffset; e2y = cy + 3
  }

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(e1x, e1y, eyeRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(e2x, e2y, eyeRadius, 0, Math.PI * 2)
  ctx.fill()

  // 瞳孔
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(e1x + dir.x * 0.8, e1y + dir.y * 0.8, 1.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(e2x + dir.x * 0.8, e2y + dir.y * 0.8, 1.2, 0, Math.PI * 2)
  ctx.fill()
}

function drawIdleScreen() {
  if (!ctx) return
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)
  drawGrid()

  // 标题
  ctx.fillStyle = 'cyan'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 20
  ctx.fillText('贪吃蛇', W / 2, H / 2 - 50)
  ctx.shadowBlur = 0

  // 装饰线
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 80, H / 2 - 25)
  ctx.lineTo(W / 2 + 80, H / 2 - 25)
  ctx.stroke()

  // 提示
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = '16px Arial'
  ctx.fillText('按空格键开始', W / 2, H / 2 + 10)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.font = '14px Arial'
  ctx.fillText('方向键 / WASD 控制方向', W / 2, H / 2 + 40)
  ctx.fillText('P 键暂停', W / 2, H / 2 + 65)
}

function drawPauseOverlay() {
  if (!ctx) return
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'cyan'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 15
  ctx.fillText('暂停', W / 2, H / 2 - 10)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '16px Arial'
  ctx.fillText('按 P 键继续', W / 2, H / 2 + 25)
}

function drawGameOverOverlay() {
  if (!ctx) return
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.fillRect(0, 0, W, H)

  // 红色边框闪烁效果
  ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, W - 4, H - 4)

  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 20
  ctx.fillText('Game Over', W / 2, H / 2 - 30)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#ffffff'
  ctx.font = '20px Arial'
  ctx.fillText(`得分: ${score.value}`, W / 2, H / 2 + 10)

  if (score.value >= bestScore.value && score.value > 0) {
    ctx.fillStyle = 'gold'
    ctx.font = '16px Arial'
    ctx.shadowColor = 'rgba(255, 215, 0, 0.5)'
    ctx.shadowBlur = 10
    ctx.fillText('新纪录!', W / 2, H / 2 + 38)
    ctx.shadowBlur = 0
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '16px Arial'
  ctx.fillText('按空格键重新开始', W / 2, H / 2 + 70)
}

// ========== 动画循环（用于食物脉冲动画） ==========
function animateFood() {
  if (gameState.value === 'playing') {
    draw()
  }
  animFrame = requestAnimationFrame(animateFood)
}

// ========== 键盘控制 ==========
function onKey(e: KeyboardEvent) {
  // 空格键：开始/重新开始
  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value === 'idle' || gameState.value === 'over') {
      start()
    }
    return
  }

  // P 键：暂停/继续
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault()
    if (gameState.value === 'playing' || gameState.value === 'paused') {
      togglePause()
    }
    return
  }

  // 方向控制
  const keyMap: Record<string, { x: number; y: number }> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    W: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    S: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    A: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    D: { x: 1, y: 0 },
  }

  const nd = keyMap[e.key]
  if (nd && (nd.x + dir.x !== 0 || nd.y + dir.y !== 0)) {
    nextDir = nd
    e.preventDefault()
  }
}

// ========== 触摸控制 ==========
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  if (gameState.value === 'idle' || gameState.value === 'over') {
    start()
    return
  }

  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (Math.max(absDx, absDy) < 20) return

  let nd: { x: number; y: number }
  if (absDx > absDy) {
    nd = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 }
  } else {
    nd = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 }
  }

  if (nd.x + dir.x !== 0 || nd.y + dir.y !== 0) {
    nextDir = nd
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  loadBest()
  drawIdleScreen()
  animFrame = requestAnimationFrame(animateFood)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  clearInterval(timer)
  cancelAnimationFrame(animFrame)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="game-page">
    <!-- 顶部标题栏 -->
    <header class="game-header">
      <router-link to="/games" class="back-link">&larr; 返回</router-link>
      <h1 class="game-title">贪吃蛇</h1>
      <div class="scores">
        <div class="score-box">
          <span class="score-label">分数</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div class="score-box">
          <span class="score-label">最高</span>
          <span class="score-value">{{ bestScore }}</span>
        </div>
      </div>
    </header>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button
        v-if="gameState === 'playing'"
        class="btn-action"
        @click="togglePause"
      >
        暂停
      </button>
      <button
        v-if="gameState === 'paused'"
        class="btn-action"
        @click="togglePause"
      >
        继续
      </button>
      <button
        v-if="gameState === 'over' || gameState === 'idle'"
        class="btn-action"
        @click="start"
      >
        {{ gameState === 'idle' ? '开始游戏' : '重新开始' }}
      </button>
    </div>

    <!-- 游戏区域 -->
    <div
      class="game-area"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <canvas ref="canvasRef" :width="W" :height="H" />
    </div>

    <!-- 底部操作提示 -->
    <div class="controls-hint">
      <template v-if="gameState === 'idle'">
        <span>空格键 开始 | 方向键/WASD 控制方向 | P 暂停</span>
      </template>
      <template v-else-if="gameState === 'playing'">
        <span>方向键/WASD 控制方向 | P 暂停 | 速度: {{ currentSpeed }}ms</span>
      </template>
      <template v-else-if="gameState === 'paused'">
        <span>游戏暂停 | P 键继续</span>
      </template>
      <template v-else>
        <span>空格键 重新开始</span>
      </template>
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
  color: #fff;
  padding: 20px;
  user-select: none;
}

/* ===== 顶部标题栏 ===== */
.game-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 12px;
  width: 100%;
  max-width: 500px;
}

.back-link {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s;
  white-space: nowrap;
}

.back-link:hover {
  opacity: 1;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.game-title {
  font-size: 24px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan, 0 0 40px rgba(0, 255, 255, 0.3);
  margin: 0;
  flex: 1;
}

.scores {
  display: flex;
  gap: 10px;
}

.score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 6px;
  min-width: 60px;
}

.score-label {
  font-size: 10px;
  color: rgba(0, 255, 255, 0.6);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.score-value {
  font-size: 16px;
  font-weight: bold;
  color: cyan;
  text-shadow: 0 0 6px rgba(0, 255, 255, 0.4);
}

/* ===== 操作按钮 ===== */
.action-bar {
  width: 100%;
  max-width: 500px;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
  min-height: 32px;
}

.btn-action {
  padding: 6px 16px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.25);
  border-radius: 6px;
  color: cyan;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 1px;
}

.btn-action:hover {
  background: rgba(0, 255, 255, 0.18);
  border-color: rgba(0, 255, 255, 0.5);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.15);
}

/* ===== 游戏区域 ===== */
.game-area {
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.05), inset 0 0 30px rgba(0, 255, 255, 0.02);
}

canvas {
  display: block;
}

/* ===== 底部提示 ===== */
.controls-hint {
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.4;
  letter-spacing: 1px;
}
</style>
