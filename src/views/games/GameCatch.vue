<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ---- Constants ----
const W = 400
const H = 600
const BASKET_W = 80
const BASKET_H = 20
const BASKET_SPEED = 6
const MAX_MISSED = 5
const BASE_FALL_SPEED = 2
const SPEED_INCREMENT = 0.0008
const SPAWN_INTERVAL_BASE = 55

// ---- Item type definitions ----
interface ItemTypeDef {
  radius: number
  points: number
  color: string
  glow: string
  label: string
}

const ITEM_TYPES: ItemTypeDef[] = [
  { radius: 8, points: 1, color: '#44ff88', glow: '#22cc66', label: 'Small' },
  { radius: 13, points: 2, color: '#ffaa22', glow: '#dd8800', label: 'Medium' },
  { radius: 18, points: 3, color: '#ff4488', glow: '#dd2266', label: 'Large' },
]

// ---- Falling item ----
interface FallingItem {
  x: number
  y: number
  radius: number
  speed: number
  points: number
  color: string
  glow: string
}

// ---- Catch particle ----
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

// ---- Reactive state ----
const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const bestScore = ref(0)
const missed = ref(0)
const gameState = ref<'idle' | 'playing' | 'over'>('idle')

// ---- Game variables ----
let ctx: CanvasRenderingContext2D | null = null
let basketX = W / 2 - BASKET_W / 2
let items: FallingItem[] = []
let particles: Particle[] = []
let animId = 0
let spawnTimer = 0
let elapsed = 0
let speedMultiplier = 1
let keysPressed = new Set<string>()
let useMouseControl = false
let mouseX = W / 2

// ---- Computed ----
const statusText = computed(() => {
  switch (gameState.value) {
    case 'idle': return '按 开始游戏 或空格键开始'
    case 'playing': return `漏接 ${missed.value}/${MAX_MISSED}`
    case 'over': return '游戏结束！'
  }
})

// ---- Lifecycle ----
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  bestScore.value = Number(localStorage.getItem('catch-best') || 0)
  drawIdle()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('mousemove', onMouseMove)
    canvasRef.value.removeEventListener('touchmove', onTouchMove)
  }
})

// ---- Game control ----
function startGame() {
  basketX = W / 2 - BASKET_W / 2
  items = []
  particles = []
  score.value = 0
  missed.value = 0
  spawnTimer = 0
  elapsed = 0
  speedMultiplier = 1
  useMouseControl = false
  keysPressed.clear()
  gameState.value = 'playing'
  animId = requestAnimationFrame(loop)
}

function gameOver() {
  gameState.value = 'over'
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('catch-best', String(bestScore.value))
  }
}

// ---- Game loop ----
function loop() {
  update()
  draw()
  if (gameState.value === 'playing') {
    animId = requestAnimationFrame(loop)
  }
}

function update() {
  elapsed++
  speedMultiplier = 1 + elapsed * SPEED_INCREMENT

  // Basket movement via keyboard
  if (!useMouseControl) {
    if (keysPressed.has('ArrowLeft') || keysPressed.has('a') || keysPressed.has('A')) {
      basketX -= BASKET_SPEED
    }
    if (keysPressed.has('ArrowRight') || keysPressed.has('d') || keysPressed.has('D')) {
      basketX += BASKET_SPEED
    }
  }
  basketX = Math.max(0, Math.min(W - BASKET_W, basketX))

  // Spawn items
  const spawnInterval = Math.max(18, SPAWN_INTERVAL_BASE - elapsed * 0.015)
  spawnTimer++
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0
    spawnItem()
  }

  // Update items
  for (const item of items) {
    item.y += item.speed * speedMultiplier
  }

  // Collision detection
  const basketTop = H - BASKET_H - 10
  items = items.filter((item) => {
    const itemBottom = item.y + item.radius
    const itemCenterX = item.x

    // Caught by basket
    if (
      itemBottom >= basketTop &&
      item.y - item.radius <= basketTop + BASKET_H &&
      itemCenterX >= basketX - item.radius &&
      itemCenterX <= basketX + BASKET_W + item.radius
    ) {
      score.value += item.points
      spawnCatchParticles(item)
      return false
    }

    // Missed - fell below screen
    if (item.y - item.radius > H) {
      missed.value++
      if (missed.value >= MAX_MISSED) {
        gameOver()
      }
      return false
    }

    return true
  })

  // Update particles
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.12
    p.life--
  }
  particles = particles.filter((p) => p.life > 0)
}

function spawnItem() {
  // Weighted random: small=50%, medium=35%, large=15%
  const roll = Math.random()
  let typeIndex: number
  if (roll < 0.5) {
    typeIndex = 0
  } else if (roll < 0.85) {
    typeIndex = 1
  } else {
    typeIndex = 2
  }

  const type = ITEM_TYPES[typeIndex]
  const x = type.radius + Math.random() * (W - type.radius * 2)

  items.push({
    x,
    y: -type.radius,
    radius: type.radius,
    speed: BASE_FALL_SPEED + Math.random() * 1.5,
    points: type.points,
    color: type.color,
    glow: type.glow,
  })
}

function spawnCatchParticles(item: FallingItem) {
  const count = 6 + item.points * 3
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const speed = 1.5 + Math.random() * 3
    particles.push({
      x: item.x,
      y: H - BASKET_H - 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 20 + Math.random() * 15,
      maxLife: 35,
      color: item.color,
      size: 2 + Math.random() * 3,
    })
  }
}

// ---- Drawing ----
function draw() {
  if (!ctx) return

  // Background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,255,255,0.03)'
  ctx.lineWidth = 0.5
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // Ground line
  ctx.strokeStyle = 'rgba(0,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, H - 5)
  ctx.lineTo(W, H - 5)
  ctx.stroke()

  // Draw items
  for (const item of items) {
    ctx.save()

    // Glow
    ctx.shadowColor = item.glow
    ctx.shadowBlur = 12

    // Main circle
    ctx.fillStyle = item.color
    ctx.beginPath()
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2)
    ctx.fill()

    // Inner highlight
    ctx.shadowBlur = 0
    const grad = ctx.createRadialGradient(
      item.x - item.radius * 0.3,
      item.y - item.radius * 0.3,
      0,
      item.x,
      item.y,
      item.radius,
    )
    grad.addColorStop(0, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2)
    ctx.fill()

    // Point label for medium/large items
    if (item.points >= 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = `bold ${item.radius}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(item.points), item.x, item.y)
    }

    ctx.restore()
  }

  // Draw particles
  for (const p of particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // Draw basket
  drawBasket()

  // HUD
  drawHUD()

  // Game over overlay
  if (gameState.value === 'over') {
    drawGameOverOverlay()
  }
}

function drawBasket() {
  if (!ctx) return
  const bx = basketX
  const by = H - BASKET_H - 10

  ctx.save()

  // Glow
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 15

  // Main body
  ctx.fillStyle = '#00ffff'
  ctx.fillRect(bx, by, BASKET_W, BASKET_H)

  ctx.shadowBlur = 0

  // Gradient overlay
  const basketGrad = ctx.createLinearGradient(bx, by, bx, by + BASKET_H)
  basketGrad.addColorStop(0, 'rgba(255,255,255,0.3)')
  basketGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)')
  basketGrad.addColorStop(1, 'rgba(0,0,0,0.2)')
  ctx.fillStyle = basketGrad
  ctx.fillRect(bx, by, BASKET_W, BASKET_H)

  // Rim highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(bx, by, BASKET_W, BASKET_H)

  ctx.restore()
}

function drawHUD() {
  if (!ctx) return

  // Score
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px Arial'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`Score: ${score.value}`, 12, 12)

  // Missed hearts
  ctx.textAlign = 'right'
  ctx.font = '16px Arial'
  const heartsLeft = MAX_MISSED - missed.value
  let heartsStr = ''
  for (let i = 0; i < MAX_MISSED; i++) {
    heartsStr += i < heartsLeft ? '\u2665' : '\u2661'
  }
  ctx.fillStyle = missed.value >= 3 ? '#ff4444' : '#ff6688'
  ctx.fillText(heartsStr, W - 12, 14)

  // Speed indicator
  ctx.fillStyle = 'rgba(0,255,255,0.5)'
  ctx.font = '12px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`Speed x${speedMultiplier.toFixed(1)}`, 12, 38)
}

function drawGameOverOverlay() {
  if (!ctx) return

  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 40px Arial'
  ctx.fillText('Game Over', W / 2, H / 2 - 50)

  ctx.fillStyle = '#ffffff'
  ctx.font = '22px Arial'
  ctx.fillText(`Score: ${score.value}`, W / 2, H / 2)

  ctx.fillStyle = 'rgba(0,255,255,0.8)'
  ctx.font = '16px Arial'
  ctx.fillText(`Best: ${bestScore.value}`, W / 2, H / 2 + 35)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '15px Arial'
  ctx.fillText('Press Space or click Restart', W / 2, H / 2 + 75)
}

function drawIdle() {
  if (!ctx) return

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,255,255,0.03)'
  ctx.lineWidth = 0.5
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // Decorative demo items
  const demoItems = [
    { x: 100, y: 180, r: 8, color: '#44ff88' },
    { x: 200, y: 140, r: 13, color: '#ffaa22' },
    { x: 300, y: 200, r: 18, color: '#ff4488' },
    { x: 150, y: 260, r: 8, color: '#44ff88' },
    { x: 260, y: 300, r: 13, color: '#ffaa22' },
  ]
  for (const d of demoItems) {
    ctx.save()
    ctx.shadowColor = d.color
    ctx.shadowBlur = 10
    ctx.fillStyle = d.color
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Demo basket
  ctx.save()
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#00ffff'
  ctx.fillRect(W / 2 - BASKET_W / 2, H - BASKET_H - 60, BASKET_W, BASKET_H)
  ctx.restore()

  // Title
  ctx.save()
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 20
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Catch Falling Items', W / 2, H / 2 - 40)
  ctx.restore()

  // Instructions
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '15px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Move basket to catch falling items', W / 2, H / 2 + 10)
  ctx.fillText('Mouse / Arrow Keys / A-D', W / 2, H / 2 + 35)

  // Point values
  ctx.font = '13px Arial'
  ctx.fillStyle = '#44ff88'
  ctx.fillText('Small = 1pt', W / 2 - 90, H / 2 + 70)
  ctx.fillStyle = '#ffaa22'
  ctx.fillText('Medium = 2pt', W / 2, H / 2 + 70)
  ctx.fillStyle = '#ff4488'
  ctx.fillText('Large = 3pt', W / 2 + 90, H / 2 + 70)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '14px Arial'
  ctx.fillText(`Miss ${MAX_MISSED} items = Game Over`, W / 2, H / 2 + 100)

  ctx.fillStyle = 'rgba(0,255,255,0.7)'
  ctx.font = '16px Arial'
  ctx.fillText('Press Space or click Start', W / 2, H / 2 + 140)
}

// ---- Input handlers ----
function onKeyDown(e: KeyboardEvent) {
  keysPressed.add(e.key)

  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd' || e.key === 'A' || e.key === 'D') {
    useMouseControl = false
    e.preventDefault()
  }

  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value === 'idle' || gameState.value === 'over') {
      startGame()
    }
  }
}

function onKeyUp(e: KeyboardEvent) {
  keysPressed.delete(e.key)
}

function onMouseMove(e: MouseEvent) {
  if (gameState.value !== 'playing') return
  const rect = canvasRef.value!.getBoundingClientRect()
  mouseX = (e.clientX - rect.left) * (W / rect.width)
  useMouseControl = true
  basketX = mouseX - BASKET_W / 2
  basketX = Math.max(0, Math.min(W - BASKET_W, basketX))
}

function onTouchMove(e: TouchEvent) {
  if (gameState.value !== 'playing') return
  e.preventDefault()
  const rect = canvasRef.value!.getBoundingClientRect()
  mouseX = (e.touches[0].clientX - rect.left) * (W / rect.width)
  useMouseControl = true
  basketX = mouseX - BASKET_W / 2
  basketX = Math.max(0, Math.min(W - BASKET_W, basketX))
}
</script>

<template>
  <div class="catch-page">
    <header class="page-header">
      <router-link to="/games" class="back">&larr; 游戏大厅</router-link>
      <h1>接住掉落物品</h1>
    </header>

    <div class="game-body">
      <!-- Info bar -->
      <div class="info-bar">
        <div class="stat">
          <span class="label">得分</span>
          <span class="value score-val">{{ score }}</span>
        </div>
        <div class="stat">
          <span class="label">最高</span>
          <span class="value best-val">{{ bestScore }}</span>
        </div>
        <div class="stat">
          <span class="label">速度</span>
          <span class="value speed-val">x{{ speedMultiplier.toFixed(1) }}</span>
        </div>
        <div class="status" :class="gameState">{{ statusText }}</div>
      </div>

      <!-- Canvas -->
      <div class="canvas-wrap">
        <canvas ref="canvasRef" :width="W" :height="H" />
        <!-- Idle overlay -->
        <div v-if="gameState === 'idle'" class="overlay">
          <div class="overlay-title">接住掉落物品</div>
          <div class="overlay-hint">按 空格键 或点击下方按钮开始</div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls">
        <button v-if="gameState === 'idle'" class="btn btn-start" @click="startGame">
          开始游戏
        </button>
        <button v-if="gameState === 'over'" class="btn btn-restart" @click="startGame">
          重新开始
        </button>
      </div>

      <!-- Help -->
      <div class="help">
        <p>方向键 / WASD / 鼠标 移动篮子 &nbsp;|&nbsp; 空格键 开始</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catch-page {
  min-height: 100vh;
  padding: 32px 40px;
  background: #0a0a0a;
  color: #eee;
}

.page-header {
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
  margin: 0;
}

.game-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* ---- Info bar ---- */
.info-bar {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 12px 28px;
  background: rgba(0, 255, 255, 0.04);
  border: 1px solid rgba(0, 255, 255, 0.12);
  border-radius: 10px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.label {
  font-size: 12px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.value {
  font-size: 22px;
  font-weight: bold;
  font-family: monospace;
}

.score-val {
  color: cyan;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.best-val {
  color: #ffcc00;
  text-shadow: 0 0 8px rgba(255, 204, 0, 0.4);
}

.speed-val {
  color: #44ff88;
  text-shadow: 0 0 8px rgba(68, 255, 136, 0.4);
}

.status {
  font-size: 14px;
  padding: 4px 14px;
  border-radius: 6px;
  background: rgba(0, 255, 255, 0.08);
  color: rgba(0, 255, 255, 0.7);
  letter-spacing: 1px;
}

.status.over {
  background: rgba(255, 34, 68, 0.15);
  color: #ff2244;
}

/* ---- Canvas ---- */
.canvas-wrap {
  position: relative;
  border: 2px solid rgba(0, 255, 255, 0.25);
  border-radius: 6px;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.08);
  overflow: hidden;
}

canvas {
  display: block;
  cursor: none;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.overlay-title {
  font-size: 42px;
  font-weight: bold;
  color: cyan;
  text-shadow: 0 0 30px cyan;
  letter-spacing: 8px;
}

.overlay-hint {
  font-size: 14px;
  opacity: 0.6;
}

/* ---- Buttons ---- */
.controls {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 32px;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 2px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s;
}

.btn-start {
  background: rgba(0, 255, 255, 0.15);
  color: cyan;
  border: 1px solid rgba(0, 255, 255, 0.4);
}

.btn-start:hover {
  background: rgba(0, 255, 255, 0.25);
  box-shadow: 0 0 16px rgba(0, 255, 255, 0.3);
}

.btn-restart {
  background: rgba(255, 34, 68, 0.12);
  color: #ff2244;
  border: 1px solid rgba(255, 34, 68, 0.35);
}

.btn-restart:hover {
  background: rgba(255, 34, 68, 0.22);
  box-shadow: 0 0 16px rgba(255, 34, 68, 0.25);
}

/* ---- Help ---- */
.help {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.4;
  letter-spacing: 1px;
}
</style>
