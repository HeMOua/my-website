<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ---- 常量 ----
const W = 600
const H = 500
const PADDLE_W = 100
const PADDLE_H = 14
const BALL_R = 6
const BRICK_ROWS = 5
const BRICK_COLS = 10
const BRICK_W = 52
const BRICK_H = 20
const BRICK_PAD = 4
const BRICK_TOP = 50
const BRICK_LEFT = (W - (BRICK_W + BRICK_PAD) * BRICK_COLS + BRICK_PAD) / 2

// ---- 响应式状态 ----
const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const lives = ref(3)
const gameState = ref<'idle' | 'playing' | 'over' | 'win'>('idle')

// ---- 游戏核心变量 ----
let ctx: CanvasRenderingContext2D | null = null
let paddleX = (W - PADDLE_W) / 2
let ballX = W / 2
let ballY = H - 40
let ballDX = 4
let ballDY = -4
let animFrame = 0
let keysDown: Set<string> = new Set()

// ---- 拖尾 ----
interface Trail { x: number; y: number; alpha: number }
let trails: Trail[] = []

// ---- 砖块 ----
interface Particle {
  x: number; y: number
  vx: number; vy: number
  alpha: number; color: string; size: number
}

interface Brick {
  x: number; y: number
  alive: boolean
  color: string; glowColor: string; points: number
  fadeTimer: number; fadeAlpha: number
  particles: Particle[]
}

let bricks: Brick[] = []

const ROW_STYLES = [
  { color: '#ff3366', glowColor: 'rgba(255,51,102,0.6)', points: 50 },
  { color: '#ff6633', glowColor: 'rgba(255,102,51,0.6)', points: 40 },
  { color: '#ffcc00', glowColor: 'rgba(255,204,0,0.6)', points: 30 },
  { color: '#33ff99', glowColor: 'rgba(51,255,153,0.6)', points: 20 },
  { color: '#00ccff', glowColor: 'rgba(0,204,255,0.6)', points: 10 },
]

// ---- 计算属性 ----
const statusText = computed(() => {
  switch (gameState.value) {
    case 'idle': return '按 开始游戏 或空格键开始'
    case 'playing': return '游戏中...'
    case 'over': return '游戏结束！'
    case 'win': return '恭喜通关！'
  }
})

const livesDisplay = computed(() => '\u2764'.repeat(lives.value))

// ---- 初始化 ----
function initBricks() {
  bricks = []
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_LEFT + c * (BRICK_W + BRICK_PAD),
        y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
        alive: true,
        color: ROW_STYLES[r].color,
        glowColor: ROW_STYLES[r].glowColor,
        points: ROW_STYLES[r].points,
        fadeTimer: 0,
        fadeAlpha: 1,
        particles: [],
      })
    }
  }
}

function resetBall() {
  ballX = W / 2
  ballY = H - 40
  ballDX = 4 * (Math.random() > 0.5 ? 1 : -1)
  ballDY = -4
  trails = []
}

function initGame() {
  score.value = 0
  lives.value = 3
  paddleX = (W - PADDLE_W) / 2
  initBricks()
  resetBall()
}

// ---- 游戏控制 ----
function startGame() {
  if (gameState.value === 'playing') return
  if (gameState.value === 'idle' || gameState.value === 'over' || gameState.value === 'win') {
    initGame()
  }
  gameState.value = 'playing'
  cancelAnimationFrame(animFrame)
  gameLoop()
}

function restartGame() {
  initGame()
  gameState.value = 'playing'
  cancelAnimationFrame(animFrame)
  gameLoop()
}

// ---- 游戏循环 ----
function gameLoop() {
  if (gameState.value !== 'playing') return
  update()
  draw()
  animFrame = requestAnimationFrame(gameLoop)
}

function update() {
  // 键盘控制挡板
  const paddleSpeed = 7
  if (keysDown.has('ArrowLeft') || keysDown.has('a') || keysDown.has('A')) {
    paddleX -= paddleSpeed
  }
  if (keysDown.has('ArrowRight') || keysDown.has('d') || keysDown.has('D')) {
    paddleX += paddleSpeed
  }
  if (paddleX < 0) paddleX = 0
  if (paddleX + PADDLE_W > W) paddleX = W - PADDLE_W

  // 拖尾
  trails.push({ x: ballX, y: ballY, alpha: 1 })
  if (trails.length > 12) trails.shift()
  trails.forEach(t => (t.alpha -= 0.08))
  trails = trails.filter(t => t.alpha > 0)

  // 移动球
  ballX += ballDX
  ballY += ballDY

  // 墙壁碰撞
  if (ballX - BALL_R < 0) {
    ballX = BALL_R
    ballDX = Math.abs(ballDX)
  }
  if (ballX + BALL_R > W) {
    ballX = W - BALL_R
    ballDX = -Math.abs(ballDX)
  }
  if (ballY - BALL_R < 0) {
    ballY = BALL_R
    ballDY = Math.abs(ballDY)
  }

  // 球落底
  if (ballY + BALL_R > H) {
    lives.value--
    if (lives.value <= 0) {
      gameOver()
      return
    }
    resetBall()
  }

  // 挡板碰撞
  const paddleY = H - 30 - PADDLE_H
  if (
    ballDY > 0 &&
    ballY + BALL_R >= paddleY &&
    ballY + BALL_R <= paddleY + PADDLE_H &&
    ballX >= paddleX &&
    ballX <= paddleX + PADDLE_W
  ) {
    const hitPos = (ballX - paddleX) / PADDLE_W
    const angle = (hitPos - 0.5) * Math.PI * 0.7
    const speed = Math.sqrt(ballDX * ballDX + ballDY * ballDY)
    ballDX = speed * Math.sin(angle)
    ballDY = -speed * Math.cos(angle)
    if (Math.abs(ballDY) < 2) {
      ballDY = -2
    }
    ballY = paddleY - BALL_R
  }

  // 砖块碰撞
  let allDestroyed = true
  for (const brick of bricks) {
    if (!brick.alive) continue
    allDestroyed = false

    if (
      ballX + BALL_R > brick.x &&
      ballX - BALL_R < brick.x + BRICK_W &&
      ballY + BALL_R > brick.y &&
      ballY - BALL_R < brick.y + BRICK_H
    ) {
      brick.alive = false
      brick.fadeTimer = 15
      brick.fadeAlpha = 1
      score.value += brick.points

      // 生成粒子
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 3
        brick.particles.push({
          x: brick.x + BRICK_W / 2,
          y: brick.y + BRICK_H / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: brick.color,
          size: 2 + Math.random() * 3,
        })
      }

      // 判断碰撞方向
      const overlapLeft = ballX + BALL_R - brick.x
      const overlapRight = brick.x + BRICK_W - (ballX - BALL_R)
      const overlapTop = ballY + BALL_R - brick.y
      const overlapBottom = brick.y + BRICK_H - (ballY - BALL_R)
      const minX = Math.min(overlapLeft, overlapRight)
      const minY = Math.min(overlapTop, overlapBottom)

      if (minX < minY) {
        ballDX = -ballDX
      } else {
        ballDY = -ballDY
      }
      break
    }
  }

  // 更新砖块动画
  for (const brick of bricks) {
    if (brick.fadeTimer > 0) {
      brick.fadeTimer--
      brick.fadeAlpha = brick.fadeTimer / 15
    }
    brick.particles.forEach(p => {
      p.x += p.vx
      p.y += p.vy
      p.alpha -= 0.05
    })
    brick.particles = brick.particles.filter(p => p.alpha > 0)
  }

  // 检查胜利
  if (allDestroyed) {
    gameWin()
  }
}

function gameOver() {
  gameState.value = 'over'
  cancelAnimationFrame(animFrame)
  draw()
  drawOverlay('#ff3366', 'GAME OVER', `最终得分: ${score.value}`)
}

function gameWin() {
  gameState.value = 'win'
  cancelAnimationFrame(animFrame)
  draw()
  drawOverlay('#33ff99', 'YOU WIN!', `最终得分: ${score.value}`)
}

// ---- 绘制 ----
function draw() {
  if (!ctx) return

  // 背景
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // 网格
  ctx.strokeStyle = 'rgba(0,255,255,0.03)'
  ctx.lineWidth = 0.5
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // 砖块
  for (const brick of bricks) {
    if (brick.alive) {
      ctx.shadowColor = brick.glowColor
      ctx.shadowBlur = 8
      ctx.fillStyle = brick.color
      ctx.beginPath()
      roundRect(ctx, brick.x, brick.y, BRICK_W, BRICK_H, 3)
      ctx.fill()
      ctx.shadowBlur = 0
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(brick.x + 2, brick.y + 2, BRICK_W - 4, BRICK_H / 3)
    } else if (brick.fadeTimer > 0 || brick.particles.length > 0) {
      if (brick.fadeTimer > 0) {
        ctx.globalAlpha = brick.fadeAlpha
        ctx.fillStyle = brick.color
        const expand = (1 - brick.fadeAlpha) * 0.3
        ctx.beginPath()
        roundRect(ctx, brick.x, brick.y, BRICK_W * (1 + expand), BRICK_H * (1 + expand), 3)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      brick.particles.forEach(p => {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 4
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    }
  }

  // 拖尾
  trails.forEach(t => {
    ctx.globalAlpha = t.alpha * 0.4
    ctx.fillStyle = 'cyan'
    ctx.beginPath()
    ctx.arc(t.x, t.y, BALL_R * t.alpha, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1

  // 小球
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 15
  ctx.fillStyle = '#00ffff'
  ctx.beginPath()
  ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // 挡板
  const paddleY = H - 30 - PADDLE_H
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 10
  const gradient = ctx.createLinearGradient(paddleX, paddleY, paddleX + PADDLE_W, paddleY)
  gradient.addColorStop(0, '#006688')
  gradient.addColorStop(0.5, '#00ccff')
  gradient.addColorStop(1, '#006688')
  ctx.fillStyle = gradient
  ctx.beginPath()
  roundRect(ctx, paddleX, paddleY, PADDLE_W, PADDLE_H, 7)
  ctx.fill()
  ctx.shadowBlur = 0

  // 生命
  ctx.fillStyle = '#ff3366'
  ctx.font = '14px Arial'
  ctx.textAlign = 'left'
  for (let i = 0; i < lives.value; i++) {
    ctx.fillText('\u2764', 10 + i * 22, H - 8)
  }
}

function drawOverlay(color: string, title: string, subtitle: string) {
  if (!ctx) return
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = color
  ctx.font = 'bold 40px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = 20
  ctx.fillText(title, W / 2, H / 2 - 20)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff'
  ctx.font = '20px monospace'
  ctx.fillText(subtitle, W / 2, H / 2 + 25)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '14px monospace'
  ctx.fillText('按空格键或点击按钮重新开始', W / 2, H / 2 + 60)
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

// ---- 键盘控制 ----
function handleKeydown(e: KeyboardEvent) {
  keysDown.add(e.key)
  if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
  }
  if (e.key === ' ') {
    if (gameState.value === 'idle') startGame()
    else if (gameState.value === 'over' || gameState.value === 'win') restartGame()
  }
}

function handleKeyup(e: KeyboardEvent) {
  keysDown.delete(e.key)
}

function handleMouseMove(e: MouseEvent) {
  if (gameState.value !== 'playing') return
  const rect = canvasRef.value!.getBoundingClientRect()
  const scaleX = W / rect.width
  const relX = (e.clientX - rect.left) * scaleX
  paddleX = relX - PADDLE_W / 2
  if (paddleX < 0) paddleX = 0
  if (paddleX + PADDLE_W > W) paddleX = W - PADDLE_W
}

// ---- 生命周期 ----
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  initGame()
  draw()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  canvas.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  canvasRef.value?.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div class="breakout-page">
    <header class="page-header">
      <router-link to="/games" class="back">&larr; 游戏大厅</router-link>
      <h1>打砖块</h1>
    </header>

    <div class="game-body">
      <!-- 信息栏 -->
      <div class="info-bar">
        <div class="stat">
          <span class="label">得分</span>
          <span class="value score-val">{{ score }}</span>
        </div>
        <div class="stat">
          <span class="label">生命</span>
          <span class="value lives-val">{{ livesDisplay }}</span>
        </div>
        <div class="status" :class="gameState">{{ statusText }}</div>
      </div>

      <!-- 画布 -->
      <div class="canvas-wrap">
        <canvas ref="canvasRef" :width="W" :height="H" />
        <!-- 初始遮罩 -->
        <div v-if="gameState === 'idle'" class="overlay">
          <div class="overlay-title">打砖块</div>
          <div class="overlay-hint">按 空格键 或点击下方按钮开始</div>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="controls">
        <button v-if="gameState === 'idle'" class="btn btn-start" @click="startGame">
          开始游戏
        </button>
        <button v-if="gameState === 'over' || gameState === 'win'" class="btn btn-restart" @click="restartGame">
          重新开始
        </button>
      </div>

      <!-- 操作说明 -->
      <div class="help">
        <p>鼠标 / 方向键 / A D 移动挡板 &nbsp;|&nbsp; 空格键 开始 &nbsp;|&nbsp; 消除所有砖块获胜</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.breakout-page {
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
  transition: opacity 0.3s, text-shadow 0.3s;
}

.back:hover {
  opacity: 1;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

h1 {
  font-size: 32px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan, 0 0 40px rgba(0, 255, 255, 0.3);
}

.game-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* ---- 信息栏 ---- */
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

.lives-val {
  color: #ff3366;
  text-shadow: 0 0 8px rgba(255, 51, 102, 0.5);
  letter-spacing: 4px;
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
  background: rgba(255, 51, 102, 0.15);
  color: #ff3366;
}

.status.win {
  background: rgba(51, 255, 153, 0.15);
  color: #33ff99;
}

/* ---- 画布 ---- */
.canvas-wrap {
  position: relative;
  border: 2px solid rgba(0, 255, 255, 0.25);
  border-radius: 6px;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.08);
  overflow: hidden;
}

canvas {
  display: block;
  max-width: 100%;
  height: auto;
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

/* ---- 按钮 ---- */
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
  background: rgba(255, 51, 102, 0.12);
  color: #ff3366;
  border: 1px solid rgba(255, 51, 102, 0.35);
}

.btn-restart:hover {
  background: rgba(255, 51, 102, 0.22);
  box-shadow: 0 0 16px rgba(255, 51, 102, 0.25);
}

/* ---- 操作说明 ---- */
.help {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.4;
  letter-spacing: 1px;
}
</style>
