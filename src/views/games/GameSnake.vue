<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const bestScore = ref(0)
const gameState = ref<'idle' | 'playing' | 'over'>('idle')

const GRID = 20
const COLS = 20
const ROWS = 20
const W = COLS * GRID
const H = ROWS * GRID
const BASE_INTERVAL = 150
const MIN_INTERVAL = 60

let ctx: CanvasRenderingContext2D
let snake: { x: number; y: number }[] = []
let dir = { x: 1, y: 0 }
let nextDir = { x: 1, y: 0 }
let food = { x: 0, y: 0 }
let animId = 0
let lastTick = 0
let interval = BASE_INTERVAL

onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  bestScore.value = Number(localStorage.getItem('snake-best') || 0)
  drawIdle()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKey)
})

function start() {
  snake = [
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 },
  ]
  dir = { x: 1, y: 0 }
  nextDir = { x: 1, y: 0 }
  score.value = 0
  interval = BASE_INTERVAL
  gameState.value = 'playing'
  placeFood()
  lastTick = performance.now()
  cancelAnimationFrame(animId)
  animId = requestAnimationFrame(loop)
}

function restart() {
  start()
}

function placeFood() {
  let pos: { x: number; y: number }
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  food = pos
}

function loop(now: number) {
  if (gameState.value !== 'playing') return

  const delta = now - lastTick
  if (delta >= interval) {
    lastTick = now - (delta % interval)
    tick()
  }

  if (gameState.value === 'playing') {
    animId = requestAnimationFrame(loop)
  }
}

function tick() {
  dir = { ...nextDir }
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }

  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    gameOver()
    return
  }

  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver()
    return
  }

  snake.unshift(head)

  if (head.x === food.x && head.y === food.y) {
    score.value++
    placeFood()
    if (interval > MIN_INTERVAL) {
      interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - (snake.length - 3) * 3)
    }
  } else {
    snake.pop()
  }

  draw()
}

function gameOver() {
  gameState.value = 'over'
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('snake-best', String(bestScore.value))
  }
  draw()
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Game Over', W / 2, H / 2 - 30)
  ctx.fillStyle = '#ffffff'
  ctx.font = '18px Arial'
  ctx.fillText(`得分: ${score.value}`, W / 2, H / 2 + 10)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '14px Arial'
  ctx.fillText('按空格键或点击按钮重新开始', W / 2, H / 2 + 45)
}

function draw() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(0,255,255,0.04)'
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

  ctx.fillStyle = '#ff4444'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(food.x * GRID + GRID / 2, food.y * GRID + GRID / 2, GRID / 2 - 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  snake.forEach((seg, i) => {
    if (i === 0) {
      ctx.fillStyle = '#66ffff'
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 10
    } else {
      const ratio = 1 - (i / snake.length) * 0.6
      const g = Math.round(255 * ratio)
      const b = Math.round(255 * ratio)
      ctx.fillStyle = `rgb(0,${g},${b})`
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }
    const pad = i === 0 ? 1 : 2
    ctx.fillRect(seg.x * GRID + pad, seg.y * GRID + pad, GRID - pad * 2, GRID - pad * 2)
  })
  ctx.shadowBlur = 0
}

function drawIdle() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  const demoSnake = [
    { x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 },
    { x: 7, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 11 },
    { x: 6, y: 12 }, { x: 7, y: 12 }, { x: 8, y: 12 },
  ]
  demoSnake.forEach((seg, i) => {
    const alpha = 0.15 - i * 0.012
    ctx.fillStyle = `rgba(0,255,255,${Math.max(alpha, 0.03)})`
    ctx.fillRect(seg.x * GRID + 2, seg.y * GRID + 2, GRID - 4, GRID - 4)
  })

  ctx.fillStyle = 'rgba(255,68,68,0.15)'
  ctx.beginPath()
  ctx.arc(12 * GRID + GRID / 2, 10 * GRID + GRID / 2, GRID / 2 - 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 20
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('贪吃蛇', W / 2, H / 2 - 40)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '15px Arial'
  ctx.fillText('按空格键或点击按钮开始', W / 2, H / 2 + 10)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '13px Arial'
  ctx.fillText('方向键 / WASD 控制方向', W / 2, H / 2 + 38)

  if (bestScore.value > 0) {
    ctx.fillStyle = 'rgba(0,255,255,0.5)'
    ctx.font = '13px Arial'
    ctx.fillText(`最高分: ${bestScore.value}`, W / 2, H / 2 + 68)
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value === 'idle' || gameState.value === 'over') {
      start()
    }
    return
  }

  if (gameState.value !== 'playing') return

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
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back-link">&larr; 返回游戏列表</router-link>
      <h1 class="game-title">贪吃蛇</h1>
      <div class="scores">
        <span>分数: {{ score }}</span>
        <span>最高: {{ bestScore }}</span>
      </div>
    </header>

    <div class="game-area">
      <canvas ref="canvasRef" :width="W" :height="H" />
    </div>

    <div class="controls">
      <span v-if="gameState === 'idle'">按空格键开始 | 方向键 / WASD 控制方向</span>
      <span v-else-if="gameState === 'playing'">方向键 / WASD 控制方向</span>
      <span v-else>游戏结束</span>
    </div>

    <div class="btn-group">
      <button v-if="gameState === 'idle'" class="btn" @click="start">开始游戏</button>
      <button v-if="gameState === 'over'" class="btn btn-restart" @click="restart">重新开始</button>
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
}

.game-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 420px;
}

.back-link {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.back-link:hover {
  opacity: 1;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.game-title {
  font-size: 24px;
  text-shadow: 0 0 15px cyan, 0 0 30px rgba(0, 255, 255, 0.3);
  flex: 1;
  margin: 0;
}

.scores {
  display: flex;
  gap: 16px;
  font-size: 14px;
  opacity: 0.8;
  white-space: nowrap;
}

.game-area {
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.08);
}

canvas {
  display: block;
}

.controls {
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.5;
}

.btn-group {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 24px;
  font-size: 14px;
  background: rgba(0, 255, 255, 0.15);
  color: cyan;
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 1px;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.25);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.2);
}

.btn-restart {
  background: rgba(255, 68, 68, 0.15);
  color: #ff6666;
  border-color: rgba(255, 68, 68, 0.4);
}

.btn-restart:hover {
  background: rgba(255, 68, 68, 0.25);
  box-shadow: 0 0 12px rgba(255, 68, 68, 0.2);
}
</style>
