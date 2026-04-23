<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const bestScore = ref(0)
const lives = ref(3)
const gameState = ref<'idle' | 'playing' | 'over'>('idle')

const W = 480
const H = 640
const BASKET_W = 80
const BASKET_H = 16
const BASKET_SPEED = 8

type ItemType = 'normal' | 'gold' | 'bomb'

interface FallingItem {
  x: number
  y: number
  type: ItemType
  speed: number
  size: number
  trail: { x: number; y: number; alpha: number }[]
}

let ctx: CanvasRenderingContext2D
let basketX = W / 2 - BASKET_W / 2
let animId = 0
let items: FallingItem[] = []
let spawnTimer = 0
let spawnInterval = 60
let baseSpeed = 2
let difficultyTimer = 0
let keys: Record<string, boolean> = {}
let mouseX: number | null = null
let useMouseControl = false

onMounted(() => {
  ctx = canvasRef.value!.getContext('2d')!
  bestScore.value = Number(localStorage.getItem('catch-best') || 0)
  drawIdle()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvasRef.value!.addEventListener('mousemove', onMouseMove)
  canvasRef.value!.addEventListener('touchmove', onTouchMove, { passive: false })
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

function start() {
  basketX = W / 2 - BASKET_W / 2
  items = []
  score.value = 0
  lives.value = 3
  spawnTimer = 0
  spawnInterval = 60
  baseSpeed = 2
  difficultyTimer = 0
  keys = {}
  mouseX = null
  useMouseControl = false
  gameState.value = 'playing'
  animId = requestAnimationFrame(loop)
}

function restart() {
  start()
}

function loop() {
  update()
  draw()
  if (gameState.value === 'playing') {
    animId = requestAnimationFrame(loop)
  }
}

function update() {
  difficultyTimer++
  if (difficultyTimer % 600 === 0) {
    baseSpeed += 0.3
    if (spawnInterval > 20) {
      spawnInterval -= 5
    }
  }

  if (useMouseControl && mouseX !== null) {
    basketX = mouseX - BASKET_W / 2
  } else {
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      basketX -= BASKET_SPEED
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      basketX += BASKET_SPEED
    }
  }
  basketX = Math.max(0, Math.min(W - BASKET_W, basketX))

  spawnTimer++
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0
    spawnItem()
  }

  for (const item of items) {
    item.trail.unshift({ x: item.x, y: item.y, alpha: 0.6 })
    if (item.trail.length > 8) {
      item.trail.pop()
    }
    for (const t of item.trail) {
      t.alpha *= 0.85
    }

    item.y += item.speed

    const basketTop = H - 40
    if (
      item.y + item.size / 2 >= basketTop &&
      item.y - item.size / 2 <= basketTop + BASKET_H &&
      item.x + item.size / 2 >= basketX &&
      item.x - item.size / 2 <= basketX + BASKET_W
    ) {
      if (item.type === 'normal') {
        score.value += 1
      } else if (item.type === 'gold') {
        score.value += 3
      } else if (item.type === 'bomb') {
        score.value -= 5
        if (score.value < 0) score.value = 0
      }
      item.y = H + 100
    }

    if (item.y > H + 20) {
      if (item.type !== 'bomb') {
        lives.value--
        if (lives.value <= 0) {
          gameOver()
          return
        }
      }
    }
  }

  items = items.filter(item => item.y <= H + 100)
}

function spawnItem() {
  const rand = Math.random()
  let type: ItemType
  if (rand < 0.15) {
    type = 'bomb'
  } else if (rand < 0.3) {
    type = 'gold'
  } else {
    type = 'normal'
  }

  const size = type === 'gold' ? 22 : type === 'bomb' ? 20 : 18
  const speed = baseSpeed + Math.random() * 1.5

  items.push({
    x: size + Math.random() * (W - size * 2),
    y: -size,
    type,
    speed,
    size,
    trail: [],
  })
}

function gameOver() {
  gameState.value = 'over'
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('catch-best', String(bestScore.value))
  }
  draw()
  // Game Over overlay
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ff4444'
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ff4444'
  ctx.shadowBlur = 20
  ctx.fillText('GAME OVER', W / 2, H / 2 - 40)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'white'
  ctx.font = '20px Arial'
  ctx.fillText(`得分: ${score.value}`, W / 2, H / 2 + 5)
  ctx.fillStyle = '#ffcc00'
  ctx.font = '16px Arial'
  ctx.fillText(`最高: ${bestScore.value}`, W / 2, H / 2 + 35)
}

function draw() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

  // 背景网格
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

  // 绘制物品
  for (const item of items) {
    for (const t of item.trail) {
      if (t.alpha < 0.05) continue
      const trailColor = item.type === 'normal'
        ? `rgba(0,255,255,${t.alpha * 0.3})`
        : item.type === 'gold'
          ? `rgba(255,215,0,${t.alpha * 0.3})`
          : `rgba(255,50,50,${t.alpha * 0.3})`
      ctx.fillStyle = trailColor
      ctx.beginPath()
      ctx.arc(t.x, t.y, item.size / 2 * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }

    if (item.type === 'normal') {
      ctx.fillStyle = '#00e5ff'
      ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (item.type === 'gold') {
      ctx.fillStyle = '#ffd700'
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.moveTo(item.x, item.y - item.size / 2)
      ctx.lineTo(item.x + item.size / 2, item.y)
      ctx.lineTo(item.x, item.y + item.size / 2)
      ctx.lineTo(item.x - item.size / 2, item.y)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillStyle = '#ff3333'
      ctx.shadowColor = '#ff3333'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ff8800'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(item.x, item.y - item.size / 2)
      ctx.lineTo(item.x + 4, item.y - item.size / 2 - 8)
      ctx.stroke()
      ctx.fillStyle = '#ffaa00'
      ctx.beginPath()
      ctx.arc(item.x + 4, item.y - item.size / 2 - 8, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  // 绘制篮子
  const basketY = H - 40
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 20
  const basketGrad = ctx.createLinearGradient(basketX, basketY, basketX + BASKET_W, basketY)
  basketGrad.addColorStop(0, '#006688')
  basketGrad.addColorStop(0.5, '#00ccff')
  basketGrad.addColorStop(1, '#006688')
  ctx.fillStyle = basketGrad
  roundRect(ctx, basketX, basketY, BASKET_W, BASKET_H, 4)
  ctx.shadowBlur = 0

  ctx.strokeStyle = 'rgba(0,255,255,0.6)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(basketX + 4, basketY + 2)
  ctx.lineTo(basketX + BASKET_W - 4, basketY + 2)
  ctx.stroke()

  // HUD
  ctx.fillStyle = 'white'
  ctx.font = 'bold 18px Arial'
  ctx.textAlign = 'left'
  ctx.fillText(`得分: ${score.value}`, 12, 30)

  ctx.textAlign = 'right'
  let livesText = ''
  for (let i = 0; i < lives.value; i++) livesText += '\u2764 '
  ctx.fillStyle = '#ff4444'
  ctx.fillText(livesText.trim(), W - 12, 30)
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
  c.fill()
}

function drawIdle() {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, W, H)

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

  ctx.fillStyle = 'cyan'
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 20
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('接住掉落物品', W / 2, H / 2 - 60)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '16px Arial'
  ctx.fillText('移动篮子接住掉落的物品', W / 2, H / 2 - 20)

  ctx.fillStyle = '#00e5ff'
  ctx.font = '14px Arial'
  ctx.fillText('\u25CF 青色物品 +1分', W / 2, H / 2 + 20)
  ctx.fillStyle = '#ffd700'
  ctx.fillText('\u25C6 金色物品 +3分', W / 2, H / 2 + 45)
  ctx.fillStyle = '#ff3333'
  ctx.fillText('\u25CF 红色炸弹 -5分', W / 2, H / 2 + 70)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '14px Arial'
  ctx.fillText('方向键 / WASD / 鼠标 控制移动', W / 2, H / 2 + 110)
  ctx.fillText('漏掉普通物品失去一条命 (3条命)', W / 2, H / 2 + 135)

  if (bestScore.value > 0) {
    ctx.fillStyle = '#ffcc00'
    ctx.font = '14px Arial'
    ctx.fillText(`最高分: ${bestScore.value}`, W / 2, H / 2 + 170)
  }
}

function onKeyDown(e: KeyboardEvent) {
  keys[e.key] = true
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd' || e.key === 'A' || e.key === 'D') {
    useMouseControl = false
  }
  if (e.key === ' ') {
    e.preventDefault()
    if (gameState.value !== 'playing') start()
  }
}

function onKeyUp(e: KeyboardEvent) {
  keys[e.key] = false
}

function onMouseMove(e: MouseEvent) {
  if (gameState.value !== 'playing') return
  useMouseControl = true
  const rect = canvasRef.value!.getBoundingClientRect()
  mouseX = (e.clientX - rect.left) * (W / rect.width)
}

function onTouchMove(e: TouchEvent) {
  if (gameState.value !== 'playing') return
  e.preventDefault()
  useMouseControl = true
  const rect = canvasRef.value!.getBoundingClientRect()
  mouseX = (e.touches[0].clientX - rect.left) * (W / rect.width)
}
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back-link">&larr; 游戏大厅</router-link>
      <h1 class="game-title">接住掉落物品</h1>
      <div class="scores">
        <div class="score-item">
          <span class="score-label">得分</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div class="score-item">
          <span class="score-label">最高</span>
          <span class="score-value best">{{ bestScore }}</span>
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
        <span v-else-if="gameState === 'playing'">方向键/WASD/鼠标 控制篮子移动</span>
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
  max-width: 480px;
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
  font-size: 22px;
  text-shadow: 0 0 15px cyan, 0 0 30px rgba(0, 255, 255, 0.2);
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
  color: cyan;
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
  cursor: none;
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
