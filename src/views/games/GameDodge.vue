<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const gameState = ref<'idle' | 'playing' | 'over'>('idle')

const W = 400
const H = 600
const PLAYER_SIZE = 30
const OBS_SIZE = 25

let ctx: CanvasRenderingContext2D
let player = { x: 0, y: 0 }
let obstacles: { x: number; y: number; speed: number }[] = []
let animFrame: number
let startTime = 0
let elapsedTime = 0
let lastSpawn = 0
let spawnInterval = 1000
let baseSpeed = 2
let keys: Record<string, boolean> = {}
let useMouseControl = false
let mouseX = 0

onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  drawIdle()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvasRef.value!.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  canvasRef.value?.removeEventListener('mousemove', onMouseMove)
})

function start() {
  player = { x: W / 2 - PLAYER_SIZE / 2, y: H - PLAYER_SIZE - 20 }
  obstacles = []
  keys = {}
  useMouseControl = false
  score.value = 0
  startTime = performance.now()
  elapsedTime = 0
  lastSpawn = 0
  spawnInterval = 1000
  baseSpeed = 2
  gameState.value = 'playing'
  animFrame = requestAnimationFrame(gameLoop)
}

function restart() {
  start()
}

function gameLoop(timestamp: number) {
  if (gameState.value !== 'playing') return

  elapsedTime = (timestamp - startTime) / 1000
  score.value = Math.floor(elapsedTime)

  // Increase difficulty over time
  baseSpeed = 2 + elapsedTime * 0.15
  spawnInterval = Math.max(200, 1000 - elapsedTime * 20)

  // Spawn obstacles
  if (timestamp - lastSpawn > spawnInterval) {
    const x = Math.random() * (W - OBS_SIZE)
    const speed = baseSpeed + Math.random() * 1.5
    obstacles.push({ x, y: -OBS_SIZE, speed })
    lastSpawn = timestamp
  }

  // Move player
  if (useMouseControl) {
    player.x = mouseX - PLAYER_SIZE / 2
  } else {
    const moveSpeed = 5
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      player.x -= moveSpeed
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      player.x += moveSpeed
    }
  }

  // Clamp player position
  player.x = Math.max(0, Math.min(W - PLAYER_SIZE, player.x))

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].y += obstacles[i].speed
    if (obstacles[i].y > H) {
      obstacles.splice(i, 1)
    }
  }

  // Collision detection
  for (const obs of obstacles) {
    if (
      player.x < obs.x + OBS_SIZE &&
      player.x + PLAYER_SIZE > obs.x &&
      player.y < obs.y + OBS_SIZE &&
      player.y + PLAYER_SIZE > obs.y
    ) {
      gameOver()
      return
    }
  }

  draw()
  animFrame = requestAnimationFrame(gameLoop)
}

function gameOver() {
  cancelAnimationFrame(animFrame)
  gameState.value = 'over'
  draw()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Game Over', W / 2, H / 2 - 20)
  ctx.fillStyle = 'white'
  ctx.font = '18px Arial'
  ctx.fillText(`存活时间: ${score.value} 秒`, W / 2, H / 2 + 20)
}

function draw() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // Draw grid lines for atmosphere
  ctx.strokeStyle = 'rgba(0,255,255,0.03)'
  ctx.lineWidth = 0.5
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // Draw obstacles
  for (const obs of obstacles) {
    ctx.fillStyle = '#ff4444'
    ctx.shadowColor = '#ff4444'
    ctx.shadowBlur = 8
    ctx.fillRect(obs.x, obs.y, OBS_SIZE, OBS_SIZE)
  }
  ctx.shadowBlur = 0

  // Draw player
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE)
  ctx.shadowBlur = 0

  // Draw score on canvas
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '14px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`时间: ${score.value}s`, 10, 24)
}

function drawIdle() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#00ffff'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('躲避障碍', W / 2, H / 2 - 60)

  // Draw sample player
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  ctx.fillRect(W / 2 - 15, H / 2 - 15, 30, 30)
  ctx.shadowBlur = 0

  // Draw sample obstacles
  ctx.fillStyle = '#ff4444'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 8
  ctx.fillRect(W / 2 - 60, H / 2 - 80, 25, 25)
  ctx.fillRect(W / 2 + 35, H / 2 - 50, 25, 25)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '16px Arial'
  ctx.fillText('方向键 / AD 键左右移动', W / 2, H / 2 + 30)
  ctx.fillText('或使用鼠标控制', W / 2, H / 2 + 55)
  ctx.fillText('躲避下落的红色方块', W / 2, H / 2 + 80)
  ctx.fillText('尽可能存活更长时间!', W / 2, H / 2 + 105)
}

function onKeyDown(e: KeyboardEvent) {
  keys[e.key] = true
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd' || e.key === 'A' || e.key === 'D') {
    useMouseControl = false
    e.preventDefault()
  }
  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value === 'idle' || gameState.value === 'over') {
      start()
    }
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys[e.key] = false
}

function onMouseMove(e: MouseEvent) {
  if (gameState.value !== 'playing') return
  const rect = canvasRef.value!.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  useMouseControl = true
}
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back">← 返回游戏列表</router-link>
      <h1>躲避障碍</h1>
      <div class="scores">
        <span>存活: {{ score }}s</span>
      </div>
    </header>

    <div class="game-area">
      <canvas ref="canvasRef" :width="W" :height="H" />
    </div>

    <div class="controls">
      <span v-if="gameState === 'idle'">按空格键或点击开始按钮</span>
      <span v-else-if="gameState === 'playing'">方向键/AD 移动 | 鼠标控制</span>
      <span v-else>游戏结束</span>
    </div>

    <div class="btn-group">
      <button v-if="gameState === 'idle'" class="btn" @click="start">开始游戏</button>
      <button v-if="gameState === 'over'" class="btn" @click="restart">重新开始</button>
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
}

.game-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 420px;
}

.back {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
}

.back:hover {
  opacity: 1;
}

h1 {
  font-size: 24px;
  text-shadow: 0 0 15px cyan;
  flex: 1;
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
