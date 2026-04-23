<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const bestScore = ref(0)
const gameState = ref<'idle' | 'playing' | 'over'>('idle')

const W = 400
const H = 600
const GRAVITY = 0.5
const FLAP = -8
const PIPE_W = 60
const PIPE_GAP = 150
const PIPE_SPEED = 3
const BIRD_R = 15

let ctx: CanvasRenderingContext2D
let bird = { x: 80, y: 300, vy: 0 }
let pipes: { x: number; topH: number; scored: boolean }[] = []
let animId = 0
let pipeTimer = 0

onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  bestScore.value = Number(localStorage.getItem('flappy-best') || 0)
  drawIdle()
  window.addEventListener('keydown', onKey)
  canvasRef.value!.addEventListener('click', onCanvasClick)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKey)
  canvasRef.value?.removeEventListener('click', onCanvasClick)
})

function start() {
  bird = { x: 80, y: 300, vy: 0 }
  pipes = []
  score.value = 0
  pipeTimer = 0
  gameState.value = 'playing'
  animId = requestAnimationFrame(loop)
}

function flap() {
  if (gameState.value === 'idle') {
    start()
    bird.vy = FLAP
    return
  }
  if (gameState.value === 'playing') {
    bird.vy = FLAP
  }
}

function onCanvasClick() {
  if (gameState.value === 'over') return
  flap()
}

function restart() {
  start()
  bird.vy = FLAP
}

function loop() {
  update()
  draw()
  if (gameState.value === 'playing') {
    animId = requestAnimationFrame(loop)
  }
}

function update() {
  // Gravity
  bird.vy += GRAVITY
  bird.y += bird.vy

  // Ceiling
  if (bird.y < BIRD_R) {
    bird.y = BIRD_R
    bird.vy = 0
  }

  // Ground
  if (bird.y > H - BIRD_R) {
    bird.y = H - BIRD_R
    gameOver()
    return
  }

  // Pipe generation
  pipeTimer++
  if (pipeTimer >= 90) {
    pipeTimer = 0
    const minTop = 60
    const maxTop = H - PIPE_GAP - 60
    const topH = minTop + Math.random() * (maxTop - minTop)
    pipes.push({ x: W, topH, scored: false })
  }

  // Move pipes
  for (const p of pipes) {
    p.x -= PIPE_SPEED
  }

  // Remove off-screen pipes
  pipes = pipes.filter(p => p.x + PIPE_W > -10)

  // Collision detection & scoring
  for (const p of pipes) {
    // Horizontal overlap
    if (bird.x + BIRD_R > p.x && bird.x - BIRD_R < p.x + PIPE_W) {
      // Top pipe
      if (bird.y - BIRD_R < p.topH) {
        gameOver()
        return
      }
      // Bottom pipe
      if (bird.y + BIRD_R > p.topH + PIPE_GAP) {
        gameOver()
        return
      }
    }

    // Scoring
    if (!p.scored && p.x + PIPE_W < bird.x) {
      p.scored = true
      score.value++
    }
  }
}

function gameOver() {
  gameState.value = 'over'
  cancelAnimationFrame(animId)
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('flappy-best', String(bestScore.value))
  }
  draw()
}

function draw() {
  // Background
  ctx.fillStyle = '#0a0a2a'
  ctx.fillRect(0, 0, W, H)

  // Draw stars for atmosphere
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137 + 23) % W
    const sy = (i * 97 + 41) % (H - 40)
    ctx.beginPath()
    ctx.arc(sx, sy, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  // Pipes
  for (const p of pipes) {
    // Top pipe body
    ctx.fillStyle = '#44aa44'
    ctx.fillRect(p.x, 0, PIPE_W, p.topH)
    // Top pipe cap
    ctx.fillStyle = '#339933'
    ctx.fillRect(p.x - 4, p.topH - 24, PIPE_W + 8, 24)
    // Top pipe highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(p.x + 4, 0, 6, p.topH - 24)

    // Bottom pipe body
    const bottomY = p.topH + PIPE_GAP
    ctx.fillStyle = '#44aa44'
    ctx.fillRect(p.x, bottomY, PIPE_W, H - bottomY)
    // Bottom pipe cap
    ctx.fillStyle = '#339933'
    ctx.fillRect(p.x - 4, bottomY, PIPE_W + 8, 24)
    // Bottom pipe highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(p.x + 4, bottomY + 24, 6, H - bottomY - 24)
  }

  // Ground line
  ctx.fillStyle = '#1a3a1a'
  ctx.fillRect(0, H - 4, W, 4)

  // Bird
  ctx.save()
  ctx.translate(bird.x, bird.y)
  const angle = Math.min(Math.max(bird.vy * 3, -30), 60) * Math.PI / 180
  ctx.rotate(angle)

  // Body glow
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#00ffff'
  ctx.beginPath()
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Body inner highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.beginPath()
  ctx.arc(-2, -3, BIRD_R * 0.6, 0, Math.PI * 2)
  ctx.fill()

  // Eye
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(5, -4, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0a0a2a'
  ctx.beginPath()
  ctx.arc(6, -4, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Beak
  ctx.fillStyle = '#ff8800'
  ctx.beginPath()
  ctx.moveTo(BIRD_R - 2, -2)
  ctx.lineTo(BIRD_R + 8, 1)
  ctx.lineTo(BIRD_R - 2, 4)
  ctx.closePath()
  ctx.fill()

  ctx.restore()

  // Score display
  ctx.fillStyle = 'white'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 4
  ctx.fillText(String(score.value), W / 2, 60)
  ctx.shadowBlur = 0

  // Game over overlay
  if (gameState.value === 'over') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, W, H)

    // Game Over text
    ctx.fillStyle = '#ff4444'
    ctx.font = 'bold 40px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Game Over', W / 2, H / 2 - 60)

    // Score
    ctx.fillStyle = 'white'
    ctx.font = 'bold 24px Arial'
    ctx.fillText(`Score: ${score.value}`, W / 2, H / 2 - 10)

    // Best score
    ctx.fillStyle = '#ffcc00'
    ctx.font = '18px Arial'
    ctx.fillText(`Best: ${bestScore.value}`, W / 2, H / 2 + 25)

    // Restart button
    const btnX = W / 2 - 70
    const btnY = H / 2 + 50
    const btnW = 140
    const btnH = 44
    ctx.fillStyle = 'rgba(0, 255, 255, 0.15)'
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)'
    ctx.lineWidth = 2
    roundRect(ctx, btnX, btnY, btnW, btnH, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#00ffff'
    ctx.font = 'bold 18px Arial'
    ctx.fillText('Restart', W / 2, btnY + 28)
  }
}

function drawIdle() {
  // Background
  ctx.fillStyle = '#0a0a2a'
  ctx.fillRect(0, 0, W, H)

  // Stars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137 + 23) % W
    const sy = (i * 97 + 41) % (H - 40)
    ctx.beginPath()
    ctx.arc(sx, sy, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  // Static bird
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(80, 280, BIRD_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Bird eye
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(85, 276, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0a0a2a'
  ctx.beginPath()
  ctx.arc(86, 276, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Bird beak
  ctx.fillStyle = '#ff8800'
  ctx.beginPath()
  ctx.moveTo(93, 278)
  ctx.lineTo(103, 281)
  ctx.lineTo(93, 284)
  ctx.closePath()
  ctx.fill()

  // Title
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 15
  ctx.fillText('Flappy Bird', W / 2, H / 2 - 40)
  ctx.shadowBlur = 0

  // Instructions
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '18px Arial'
  ctx.fillText('Click or Space to Start', W / 2, H / 2 + 10)

  // Controls hint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.font = '14px Arial'
  ctx.fillText('Space / Click / Tap to Flap', W / 2, H / 2 + 45)

  // Best score
  if (bestScore.value > 0) {
    ctx.fillStyle = '#ffcc00'
    ctx.font = '16px Arial'
    ctx.fillText(`Best: ${bestScore.value}`, W / 2, H / 2 + 80)
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + w - r, y)
  context.quadraticCurveTo(x + w, y, x + w, y + r)
  context.lineTo(x + w, y + h - r)
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  context.lineTo(x + r, y + h)
  context.quadraticCurveTo(x, y + h, x, y + h - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (gameState.value === 'over') {
      restart()
    } else {
      flap()
    }
  }
}
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back">&larr; Back to Games</router-link>
      <h1>Flappy Bird</h1>
      <div class="scores">
        <span>Score: {{ score }}</span>
        <span>Best: {{ bestScore }}</span>
      </div>
    </header>

    <div class="game-area">
      <canvas ref="canvasRef" :width="W" :height="H" />
    </div>

    <div class="controls">
      <span v-if="gameState === 'idle'">Click or Space to Start</span>
      <span v-else-if="gameState === 'playing'">Space / Click to Flap</span>
      <span v-else>Game Over - Click Restart or press Space</span>
    </div>

    <div class="btn-group">
      <button v-if="gameState === 'over'" class="btn" @click="restart">Restart</button>
    </div>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0a0a2a;
  padding: 20px;
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
  transition: opacity 0.3s;
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

.scores {
  display: flex;
  gap: 16px;
  font-size: 14px;
  opacity: 0.8;
  color: white;
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
  cursor: pointer;
}

.controls {
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.5;
  color: white;
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
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.25);
}
</style>
