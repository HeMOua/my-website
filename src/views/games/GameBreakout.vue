<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const lives = ref(3)
const gameState = ref<'start' | 'playing' | 'win' | 'gameover'>('start')

const CANVAS_W = 480
const CANVAS_H = 640
const PADDLE_W = 100
const PADDLE_H = 15
const PADDLE_Y = CANVAS_H - 50
const BALL_R = 8
const BRICK_ROWS = 5
const BRICK_COLS = 8
const BRICK_H = 25
const BRICK_PADDING = 4
const BRICK_OFFSET_TOP = 60
const BRICK_OFFSET_LEFT = 10
const BRICK_W = (CANVAS_W - 2 * BRICK_OFFSET_LEFT - (BRICK_COLS - 1) * BRICK_PADDING) / BRICK_COLS
const BRICK_COLORS = ['#ff4444', '#ff8844', '#ffcc44', '#44ff44', '#4488ff']
const BASE_SPEED = 5

interface Brick {
  x: number
  y: number
  w: number
  h: number
  color: string
  alive: boolean
}

let ctx: CanvasRenderingContext2D
let bricks: Brick[] = []
let paddleX = (CANVAS_W - PADDLE_W) / 2
let ballX = CANVAS_W / 2
let ballY = PADDLE_Y - BALL_R
let ballDX = 0
let ballDY = 0
let animId = 0
let totalBricks = 0
let destroyedBricks = 0

function initBricks() {
  bricks = []
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_OFFSET_LEFT + c * (BRICK_W + BRICK_PADDING),
        y: BRICK_OFFSET_TOP + r * (BRICK_H + BRICK_PADDING),
        w: BRICK_W,
        h: BRICK_H,
        color: BRICK_COLORS[r],
        alive: true,
      })
    }
  }
  totalBricks = bricks.length
  destroyedBricks = 0
}

function resetBall() {
  ballX = CANVAS_W / 2
  ballY = PADDLE_Y - BALL_R
  const angle = -(Math.PI / 4) - Math.random() * (Math.PI / 2)
  ballDX = BASE_SPEED * Math.cos(angle)
  ballDY = BASE_SPEED * Math.sin(angle)
  if (ballDY > 0) ballDY = -ballDY
}

function start() {
  score.value = 0
  lives.value = 3
  paddleX = (CANVAS_W - PADDLE_W) / 2
  initBricks()
  resetBall()
  gameState.value = 'playing'
  cancelAnimationFrame(animId)
  gameLoop()
}

function gameLoop() {
  if (gameState.value !== 'playing') return
  update()
  draw()
  animId = requestAnimationFrame(gameLoop)
}

function update() {
  ballX += ballDX
  ballY += ballDY

  // Left wall
  if (ballX - BALL_R <= 0) {
    ballX = BALL_R
    ballDX = Math.abs(ballDX)
  }
  // Right wall
  if (ballX + BALL_R >= CANVAS_W) {
    ballX = CANVAS_W - BALL_R
    ballDX = -Math.abs(ballDX)
  }
  // Top wall
  if (ballY - BALL_R <= 0) {
    ballY = BALL_R
    ballDY = Math.abs(ballDY)
  }

  // Ball fell below paddle
  if (ballY - BALL_R > CANVAS_H) {
    lives.value--
    if (lives.value <= 0) {
      gameState.value = 'gameover'
      drawGameOver()
      return
    }
    resetBall()
    return
  }

  // Paddle collision
  if (
    ballDY > 0 &&
    ballY + BALL_R >= PADDLE_Y &&
    ballY + BALL_R <= PADDLE_Y + PADDLE_H + 4 &&
    ballX >= paddleX - BALL_R &&
    ballX <= paddleX + PADDLE_W + BALL_R
  ) {
    const hitPos = (ballX - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2)
    const clampedHit = Math.max(-1, Math.min(1, hitPos))
    const currentSpeed = Math.sqrt(ballDX * ballDX + ballDY * ballDY)
    const maxAngle = Math.PI / 3
    ballDX = currentSpeed * Math.sin(clampedHit * maxAngle)
    ballDY = -currentSpeed * Math.cos(clampedHit * maxAngle)
    ballY = PADDLE_Y - BALL_R
  }

  // Brick collisions
  for (const brick of bricks) {
    if (!brick.alive) continue

    const closestX = Math.max(brick.x, Math.min(ballX, brick.x + brick.w))
    const closestY = Math.max(brick.y, Math.min(ballY, brick.y + brick.h))
    const distX = ballX - closestX
    const distY = ballY - closestY

    if (distX * distX + distY * distY < BALL_R * BALL_R) {
      brick.alive = false
      destroyedBricks++
      score.value += 10

      // Determine reflection direction
      const overlapLeft = ballX + BALL_R - brick.x
      const overlapRight = brick.x + brick.w - (ballX - BALL_R)
      const overlapTop = ballY + BALL_R - brick.y
      const overlapBottom = brick.y + brick.h - (ballY - BALL_R)

      const minX = Math.min(overlapLeft, overlapRight)
      const minY = Math.min(overlapTop, overlapBottom)

      if (minX < minY) {
        ballDX = -ballDX
      } else {
        ballDY = -ballDY
      }

      // Increase speed slightly as bricks are destroyed
      const speedMultiplier = 1 + destroyedBricks * 0.008
      const currentSpeed = Math.sqrt(ballDX * ballDX + ballDY * ballDY)
      const newSpeed = Math.min(BASE_SPEED * speedMultiplier, BASE_SPEED * 1.8)
      const ratio = newSpeed / currentSpeed
      ballDX *= ratio
      ballDY *= ratio

      // Check win
      if (destroyedBricks >= totalBricks) {
        gameState.value = 'win'
        drawWin()
        return
      }

      break
    }
  }
}

function draw() {
  // Clear
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Draw bricks
  for (const brick of bricks) {
    if (!brick.alive) continue
    ctx.fillStyle = brick.color
    ctx.shadowColor = brick.color
    ctx.shadowBlur = 6
    roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 3)
    ctx.fill()
  }
  ctx.shadowBlur = 0

  // Draw paddle
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  roundRect(ctx, paddleX, PADDLE_Y, PADDLE_W, PADDLE_H, 4)
  ctx.fill()
  ctx.shadowBlur = 0

  // Draw ball
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Draw HUD
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '16px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`分数: ${score.value}`, 15, 30)
  ctx.textAlign = 'right'
  const heartsStr = '\u2764'.repeat(lives.value)
  ctx.fillStyle = '#ff4444'
  ctx.fillText(heartsStr, CANVAS_W - 15, 30)
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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

function drawStart() {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Decorative bricks in background
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const x = BRICK_OFFSET_LEFT + c * (BRICK_W + BRICK_PADDING)
      const y = BRICK_OFFSET_TOP + r * (BRICK_H + BRICK_PADDING)
      ctx.fillStyle = BRICK_COLORS[r]
      ctx.globalAlpha = 0.25
      roundRect(ctx, x, y, BRICK_W, BRICK_H, 3)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  // Title
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 44px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 25
  ctx.fillText('打砖块', CANVAS_W / 2, CANVAS_H / 2 - 50)
  ctx.shadowBlur = 0

  // Subtitle
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '18px Arial'
  ctx.fillText('移动鼠标控制挡板', CANVAS_W / 2, CANVAS_H / 2 + 5)
  ctx.fillText('点击按钮或按空格键开始', CANVAS_W / 2, CANVAS_H / 2 + 35)

  // Decorative ball
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.arc(CANVAS_W / 2, CANVAS_H / 2 + 80, BALL_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Decorative paddle
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 8
  roundRect(ctx, CANVAS_W / 2 - PADDLE_W / 2, CANVAS_H / 2 + 100, PADDLE_W, PADDLE_H, 4)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 44px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 25
  ctx.fillText('游戏结束', CANVAS_W / 2, CANVAS_H / 2 - 40)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#fff'
  ctx.font = '22px Arial'
  ctx.fillText(`最终分数: ${score.value}`, CANVAS_W / 2, CANVAS_H / 2 + 10)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '16px Arial'
  ctx.fillText('点击按钮或按空格键重新开始', CANVAS_W / 2, CANVAS_H / 2 + 50)
}

function drawWin() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle = '#44ff44'
  ctx.font = 'bold 44px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#44ff44'
  ctx.shadowBlur = 25
  ctx.fillText('恭喜通关!', CANVAS_W / 2, CANVAS_H / 2 - 40)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#fff'
  ctx.font = '22px Arial'
  ctx.fillText(`最终分数: ${score.value}`, CANVAS_W / 2, CANVAS_H / 2 + 10)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '16px Arial'
  ctx.fillText('点击按钮或按空格键重新开始', CANVAS_W / 2, CANVAS_H / 2 + 50)
}

function onMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_W / rect.width
  const mouseX = (e.clientX - rect.left) * scaleX
  paddleX = Math.max(0, Math.min(CANVAS_W - PADDLE_W, mouseX - PADDLE_W / 2))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value === 'start' || gameState.value === 'gameover' || gameState.value === 'win') {
      start()
    }
  }
}

onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  initBricks()
  drawStart()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back">← 返回游戏列表</router-link>
      <h1>打砖块</h1>
      <div class="scores">
        <span>分数: {{ score }}</span>
        <span>生命: {{ lives }}</span>
      </div>
    </header>

    <div class="game-area">
      <canvas
        ref="canvasRef"
        :width="CANVAS_W"
        :height="CANVAS_H"
        @mousemove="onMouseMove"
      />
    </div>

    <div class="controls">
      <span v-if="gameState === 'start'">移动鼠标控制挡板 | 点击按钮或空格键开始</span>
      <span v-else-if="gameState === 'playing'">移动鼠标控制挡板</span>
      <span v-else-if="gameState === 'gameover'">游戏结束</span>
      <span v-else-if="gameState === 'win'">恭喜通关!</span>
    </div>

    <div class="btn-group">
      <button v-if="gameState === 'start'" class="btn" @click="start">开始游戏</button>
      <button v-if="gameState === 'gameover' || gameState === 'win'" class="btn" @click="start">重新开始</button>
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
  color: #fff;
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
  font-size: 24px;
  text-shadow: 0 0 15px cyan;
  flex: 1;
  margin: 0;
}

.scores {
  display: flex;
  gap: 16px;
  font-size: 14px;
  opacity: 0.8;
}

.game-area {
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

canvas {
  display: block;
  cursor: none;
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
  transition: all 0.3s;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.25);
}
</style>
