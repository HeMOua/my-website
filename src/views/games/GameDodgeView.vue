<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const bestScore = ref(0)
const lives = ref(3)
const gameState = ref<'idle' | 'playing' | 'over'>('idle')

const W = 400
const H = 600
const PLAYER_SIZE = 30
const OBS_SIZE = 25

let ctx: CanvasRenderingContext2D
let player = { x: 0, y: 0 }
let obstacles: { x: number; y: number; speed: number; color: string; size: number }[] = []
let animFrame: number
let startTime = 0
let elapsedTime = 0
let lastSpawn = 0
let spawnInterval = 1000
let baseSpeed = 2
let keys: Record<string, boolean> = {}
let useMouseControl = false
let mouseX = 0

// 粒子效果
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  color: string
  size: number
}
let particles: Particle[] = []

const OBS_COLORS = ['#ff4444', '#ff6644', '#ff8844', '#cc4444', '#ee5555']

onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  bestScore.value = Number(localStorage.getItem('dodge-best') || 0)
  drawIdle()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvasRef.value!.addEventListener('mousemove', onMouseMove)
  canvasRef.value!.addEventListener('touchmove', onTouchMove, { passive: false })
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
  particles = []
  keys = {}
  useMouseControl = false
  score.value = 0
  lives.value = 3
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

  // 难度递增
  baseSpeed = 2 + elapsedTime * 0.15
  spawnInterval = Math.max(200, 1000 - elapsedTime * 20)

  // 生成障碍物
  if (timestamp - lastSpawn > spawnInterval) {
    const size = OBS_SIZE + Math.random() * 10
    const x = Math.random() * (W - size)
    const speed = baseSpeed + Math.random() * 1.5
    const color = OBS_COLORS[Math.floor(Math.random() * OBS_COLORS.length)]
    obstacles.push({ x, y: -size, speed, color, size })
    lastSpawn = timestamp
  }

  // 移动玩家
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
  player.x = Math.max(0, Math.min(W - PLAYER_SIZE, player.x))

  // 移动障碍物
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].y += obstacles[i].speed
    if (obstacles[i].y > H + 20) {
      obstacles.splice(i, 1)
    }
  }

  // 碰撞检测
  for (const obs of obstacles) {
    if (
      player.x < obs.x + obs.size &&
      player.x + PLAYER_SIZE > obs.x &&
      player.y < obs.y + obs.size &&
      player.y + PLAYER_SIZE > obs.y
    ) {
      // 碰撞 - 生成粒子
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 3
        particles.push({
          x: player.x + PLAYER_SIZE / 2,
          y: player.y + PLAYER_SIZE / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: '#ff4444',
          size: 2 + Math.random() * 3,
        })
      }

      lives.value--
      // 移除碰撞的障碍物
      const idx = obstacles.indexOf(obs)
      if (idx > -1) obstacles.splice(idx, 1)

      if (lives.value <= 0) {
        gameOver()
        return
      }
      break
    }
  }

  // 更新粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.alpha -= 0.03
    if (p.alpha <= 0) {
      particles.splice(i, 1)
    }
  }

  draw()
  animFrame = requestAnimationFrame(gameLoop)
}

function gameOver() {
  cancelAnimationFrame(animFrame)
  gameState.value = 'over'
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('dodge-best', String(bestScore.value))
  }
  draw()
  // Game Over overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ff4444'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 20
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('GAME OVER', W / 2, H / 2 - 40)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'white'
  ctx.font = '20px Arial'
  ctx.fillText(`存活时间: ${score.value} 秒`, W / 2, H / 2 + 5)
  ctx.fillStyle = '#ffcc00'
  ctx.font = '16px Arial'
  ctx.fillText(`最高: ${bestScore.value} 秒`, W / 2, H / 2 + 35)
}

function draw() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // 背景网格
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

  // 绘制障碍物
  for (const obs of obstacles) {
    ctx.fillStyle = obs.color
    ctx.shadowColor = obs.color
    ctx.shadowBlur = 8
    ctx.fillRect(obs.x, obs.y, obs.size, obs.size)
    // 高光
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(obs.x + 2, obs.y + 2, obs.size - 4, obs.size / 3)
  }
  ctx.shadowBlur = 0

  // 绘制粒子
  for (const p of particles) {
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = p.color
    ctx.shadowColor = p.color
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  // 绘制玩家
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  // 三角形玩家
  ctx.beginPath()
  ctx.moveTo(player.x + PLAYER_SIZE / 2, player.y)
  ctx.lineTo(player.x + PLAYER_SIZE, player.y + PLAYER_SIZE)
  ctx.lineTo(player.x, player.y + PLAYER_SIZE)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // HUD - 时间
  ctx.fillStyle = 'white'
  ctx.font = 'bold 18px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`${score.value}s`, 12, 30)

  // HUD - 生命
  ctx.textAlign = 'right'
  let livesText = ''
  for (let i = 0; i < lives.value; i++) livesText += '\u2764 '
  ctx.fillStyle = '#ff4444'
  ctx.fillText(livesText.trim(), W - 12, 30)
}

function drawIdle() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // 背景网格
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

  // 标题
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 20
  ctx.font = 'bold 36px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('躲避障碍', W / 2, H / 2 - 80)
  ctx.shadowBlur = 0

  // 示例玩家
  ctx.fillStyle = '#00ffff'
  ctx.shadowColor = '#00ffff'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(W / 2, H / 2 - 30)
  ctx.lineTo(W / 2 + 15, H / 2)
  ctx.lineTo(W / 2 - 15, H / 2)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // 示例障碍物
  ctx.fillStyle = '#ff4444'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 8
  ctx.fillRect(W / 2 - 60, H / 2 - 90, 25, 25)
  ctx.fillRect(W / 2 + 35, H / 2 - 60, 25, 25)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '16px Arial'
  ctx.fillText('方向键 / AD 键左右移动', W / 2, H / 2 + 30)
  ctx.fillText('或使用鼠标控制', W / 2, H / 2 + 55)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '14px Arial'
  ctx.fillText('躲避下落的红色方块', W / 2, H / 2 + 85)
  ctx.fillText('3条命，碰到障碍物扣1条命', W / 2, H / 2 + 110)
  ctx.fillText('尽可能存活更长时间!', W / 2, H / 2 + 135)

  if (bestScore.value > 0) {
    ctx.fillStyle = '#ffcc00'
    ctx.font = '14px Arial'
    ctx.fillText(`最高存活: ${bestScore.value}秒`, W / 2, H / 2 + 170)
  }
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

function onTouchMove(e: TouchEvent) {
  if (gameState.value !== 'playing') return
  e.preventDefault()
  const rect = canvasRef.value!.getBoundingClientRect()
  mouseX = e.touches[0].clientX - rect.left
  useMouseControl = true
}
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back-link">&larr; 游戏大厅</router-link>
      <h1 class="game-title">躲避障碍</h1>
      <div class="scores">
        <div class="score-item">
          <span class="score-label">存活</span>
          <span class="score-value">{{ score }}s</span>
        </div>
        <div class="score-item">
          <span class="score-label">最高</span>
          <span class="score-value best">{{ bestScore }}s</span>
        </div>
        <div class="score-item">
          <span class="score-label">生命</span>
          <span class="lives">
            <span v-for="i in lives" :key="i" class="heart">&#9829;</span>
          </span>
        </div>
      </div>
    </header>

    <div class="game-area">
      <canvas ref="canvasRef" :width="W" :height="H" />
    </div>

    <div class="game-footer">
      <div class="controls-hint">
        <span v-if="gameState === 'idle'">按空格键或点击开始按钮</span>
        <span v-else-if="gameState === 'playing'">方向键/AD 移动 | 鼠标控制</span>
        <span v-else>游戏结束</span>
      </div>
      <div class="btn-group">
        <button v-if="gameState === 'idle'" class="btn btn-start" @click="start">开始游戏</button>
        <button v-if="gameState === 'over'" class="btn btn-restart" @click="restart">重新开始</button>
      </div>
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
  gap: 16px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 420px;
}

.back-link {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  transition: all 0.3s;
  white-space: nowrap;
  padding: 4px 12px;
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 4px;
}

.back-link:hover {
  opacity: 1;
  border-color: rgba(0, 255, 255, 0.5);
  text-shadow: 0 0 8px cyan;
}

.game-title {
  font-size: 24px;
  text-shadow: 0 0 15px #00ffff, 0 0 30px rgba(0, 255, 255, 0.2);
  flex: 1;
  margin: 0;
  letter-spacing: 2px;
}

.scores {
  display: flex;
  align-items: center;
  gap: 14px;
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.score-label {
  font-size: 10px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score-value {
  font-size: 18px;
  font-weight: bold;
  color: #00ffff;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.score-value.best {
  color: #ffcc00;
  text-shadow: 0 0 8px rgba(255, 204, 0, 0.4);
}

.lives {
  display: flex;
  gap: 4px;
}

.heart {
  color: #ff4444;
  font-size: 14px;
  text-shadow: 0 0 6px rgba(255, 68, 68, 0.5);
}

.game-area {
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.08), inset 0 0 30px rgba(0, 255, 255, 0.03);
}

canvas {
  display: block;
}

.game-footer {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.controls-hint {
  font-size: 14px;
  opacity: 0.6;
}

.btn-group {
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
  background: rgba(255, 68, 68, 0.12);
  color: #ff4444;
  border: 1px solid rgba(255, 68, 68, 0.35);
}

.btn-restart:hover {
  background: rgba(255, 68, 68, 0.22);
  box-shadow: 0 0 16px rgba(255, 68, 68, 0.25);
}
</style>
