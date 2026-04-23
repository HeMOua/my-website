<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// ─── 常量 ───
const CANVAS_W = 400
const CANVAS_H = 600
const GRAVITY = 0.45
const JUMP_FORCE = -7.5
const PIPE_WIDTH = 52
const PIPE_GAP = 150
const PIPE_SPEED = 2.5
const PIPE_INTERVAL = 100 // 帧数间隔
const GROUND_H = 60
const BIRD_RADIUS = 15
const BIRD_X = 80

// ─── 类型 ───
interface Pipe {
  x: number
  topH: number
  scored: boolean
}

type GameState = 'idle' | 'playing' | 'over'

// ─── 响应式 ───
const canvasRef = ref<HTMLCanvasElement | null>(null)
const gameState = ref<GameState>('idle')
const score = ref(0)
const bestScore = ref(0)
const showOverlay = ref(true)

// ─── 游戏变量 ───
let ctx: CanvasRenderingContext2D | null = null
let animId = 0
let birdY = CANVAS_H / 2
let birdVY = 0
let pipes: Pipe[] = []
let frameCount = 0
let groundOffset = 0

// ─── 初始化 ───
function init() {
  birdY = CANVAS_H / 2
  birdVY = 0
  pipes = []
  frameCount = 0
  groundOffset = 0
  score.value = 0
}

// ─── 跳跃 ───
function jump() {
  if (gameState.value === 'idle') {
    gameState.value = 'playing'
    showOverlay.value = false
    init()
    birdVY = JUMP_FORCE
    loop()
    return
  }
  if (gameState.value === 'playing') {
    birdVY = JUMP_FORCE
  }
}

// ─── 重新开始 ───
function restart() {
  gameState.value = 'playing'
  showOverlay.value = false
  init()
  birdVY = JUMP_FORCE
  cancelAnimationFrame(animId)
  loop()
}

// ─── 生成管道 ───
function spawnPipe() {
  const minTop = 60
  const maxTop = CANVAS_H - GROUND_H - PIPE_GAP - 60
  const topH = Math.random() * (maxTop - minTop) + minTop
  pipes.push({ x: CANVAS_W, topH, scored: false })
}

// ─── 碰撞检测 ───
function checkCollision(): boolean {
  // 天花板 / 地面
  if (birdY - BIRD_RADIUS < 0 || birdY + BIRD_RADIUS > CANVAS_H - GROUND_H) {
    return true
  }
  // 管道
  for (const p of pipes) {
    if (
      BIRD_X + BIRD_RADIUS > p.x &&
      BIRD_X - BIRD_RADIUS < p.x + PIPE_WIDTH
    ) {
      if (birdY - BIRD_RADIUS < p.topH || birdY + BIRD_RADIUS > p.topH + PIPE_GAP) {
        return true
      }
    }
  }
  return false
}

// ─── 更新逻辑 ───
function update() {
  frameCount++

  // 小鸟物理
  birdVY += GRAVITY
  birdY += birdVY

  // 地面滚动
  groundOffset = (groundOffset + PIPE_SPEED) % 24

  // 生成管道
  if (frameCount % PIPE_INTERVAL === 0) {
    spawnPipe()
  }

  // 移动管道 + 计分
  for (const p of pipes) {
    p.x -= PIPE_SPEED
    if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
      p.scored = true
      score.value++
    }
  }

  // 移除屏幕外管道
  pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -10)

  // 碰撞
  if (checkCollision()) {
    gameOver()
  }
}

// ─── 游戏结束 ───
function gameOver() {
  gameState.value = 'over'
  showOverlay.value = true
  cancelAnimationFrame(animId)
  if (score.value > bestScore.value) {
    bestScore.value = score.value
  }
}

// ─── 绘制 ───
function draw() {
  if (!ctx) return

  // 背景
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 管道
  for (const p of pipes) {
    // 上管道
    const grad1 = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0)
    grad1.addColorStop(0, '#1b8c1b')
    grad1.addColorStop(0.5, '#2ecc40')
    grad1.addColorStop(1, '#1b8c1b')
    ctx.fillStyle = grad1
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topH)
    // 上管道帽
    ctx.fillStyle = '#24a824'
    ctx.fillRect(p.x - 4, p.topH - 20, PIPE_WIDTH + 8, 20)
    ctx.strokeStyle = '#0d5e0d'
    ctx.lineWidth = 2
    ctx.strokeRect(p.x - 4, p.topH - 20, PIPE_WIDTH + 8, 20)

    // 下管道
    const bottomY = p.topH + PIPE_GAP
    const bottomH = CANVAS_H - GROUND_H - bottomY
    const grad2 = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0)
    grad2.addColorStop(0, '#1b8c1b')
    grad2.addColorStop(0.5, '#2ecc40')
    grad2.addColorStop(1, '#1b8c1b')
    ctx.fillStyle = grad2
    ctx.fillRect(p.x, bottomY, PIPE_WIDTH, bottomH)
    // 下管道帽
    ctx.fillStyle = '#24a824'
    ctx.fillRect(p.x - 4, bottomY, PIPE_WIDTH + 8, 20)
    ctx.strokeStyle = '#0d5e0d'
    ctx.lineWidth = 2
    ctx.strokeRect(p.x - 4, bottomY, PIPE_WIDTH + 8, 20)
  }

  // 地面
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, GROUND_H)
  // 地面纹理线
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  for (let i = -groundOffset; i < CANVAS_W; i += 24) {
    ctx.beginPath()
    ctx.moveTo(i, CANVAS_H - GROUND_H)
    ctx.lineTo(i + 12, CANVAS_H)
    ctx.stroke()
  }
  // 地面顶线
  ctx.strokeStyle = 'cyan'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, CANVAS_H - GROUND_H)
  ctx.lineTo(CANVAS_W, CANVAS_H - GROUND_H)
  ctx.stroke()

  // 小鸟
  drawBird()

  // 分数（游戏中）
  if (gameState.value === 'playing') {
    ctx.fillStyle = 'white'
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.shadowColor = 'cyan'
    ctx.shadowBlur = 10
    ctx.fillText(String(score.value), CANVAS_W / 2, 50)
    ctx.shadowBlur = 0
  }
}

// ─── 绘制小鸟 ───
function drawBird() {
  if (!ctx) return
  const angle = Math.min(Math.max(birdVY * 3, -30), 60) * (Math.PI / 180)

  ctx.save()
  ctx.translate(BIRD_X, birdY)
  ctx.rotate(angle)

  // 身体
  ctx.beginPath()
  ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd700'
  ctx.fill()
  ctx.strokeStyle = '#cc9900'
  ctx.lineWidth = 2
  ctx.stroke()

  // 翅膀
  ctx.beginPath()
  ctx.ellipse(-4, 2, 10, 6, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = '#ffec80'
  ctx.fill()

  // 眼睛
  ctx.beginPath()
  ctx.arc(6, -4, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'white'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(7, -4, 2, 0, Math.PI * 2)
  ctx.fillStyle = 'black'
  ctx.fill()

  // 嘴巴
  ctx.beginPath()
  ctx.moveTo(12, 0)
  ctx.lineTo(20, -3)
  ctx.lineTo(20, 3)
  ctx.closePath()
  ctx.fillStyle = '#ff6600'
  ctx.fill()

  ctx.restore()
}

// ─── 主循环 ───
function loop() {
  update()
  draw()
  if (gameState.value === 'playing') {
    animId = requestAnimationFrame(loop)
  }
}

// ─── 空闲状态绘制 ───
function drawIdle() {
  if (!ctx) return
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 地面
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, GROUND_H)
  ctx.strokeStyle = 'cyan'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, CANVAS_H - GROUND_H)
  ctx.lineTo(CANVAS_W, CANVAS_H - GROUND_H)
  ctx.stroke()

  // 小鸟浮动
  birdY = CANVAS_H / 2 + Math.sin(Date.now() / 300) * 10
  drawBird()

  // 标题
  ctx.fillStyle = 'cyan'
  ctx.font = 'bold 28px monospace'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'cyan'
  ctx.shadowBlur = 15
  ctx.fillText('Flappy Bird', CANVAS_W / 2, 100)
  ctx.shadowBlur = 0
}

// ─── 空闲动画 ───
let idleAnimId = 0
function idleLoop() {
  drawIdle()
  if (gameState.value === 'idle') {
    idleAnimId = requestAnimationFrame(idleLoop)
  }
}

// ─── 事件 ───
function onKeydown(e: KeyboardEvent) {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault()
    jump()
  }
}

function onClickCanvas() {
  if (gameState.value === 'over') return
  jump()
}

// ─── 生命周期 ───
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  gameState.value = 'idle'
  showOverlay.value = true
  idleLoop()

  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  cancelAnimationFrame(idleAnimId)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flappy-page">
    <header class="game-header">
      <router-link to="/games" class="back-link">&larr; 游戏大厅</router-link>
      <h1 class="game-title">Flappy Bird</h1>
    </header>

    <div class="game-container">
      <canvas
        ref="canvasRef"
        :width="CANVAS_W"
        :height="CANVAS_H"
        class="game-canvas"
        @click="onClickCanvas"
      />

      <!-- 开始 / 结束遮罩 -->
      <div v-if="showOverlay" class="overlay" @click.self="onClickCanvas">
        <!-- 开始界面 -->
        <div v-if="gameState === 'idle'" class="overlay-content">
          <p class="hint-text">点击画面或按空格键开始</p>
          <p class="sub-hint">躲避管道，挑战高分!</p>
        </div>

        <!-- 结束界面 -->
        <div v-if="gameState === 'over'" class="overlay-content">
          <p class="over-title">GAME OVER</p>
          <p class="final-score">得分: {{ score }}</p>
          <p class="best-score">最高: {{ bestScore }}</p>
          <button class="restart-btn" @click="restart">重新开始</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flappy-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #0a0a0a;
  padding: 24px;
}

.game-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 400px;
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
}

.game-title {
  font-size: 24px;
  letter-spacing: 3px;
  text-shadow: 0 0 15px cyan;
  margin: 0;
}

.game-container {
  position: relative;
  border: 2px solid rgba(0, 255, 255, 0.3);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.1);
}

.game-canvas {
  display: block;
  cursor: pointer;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.hint-text {
  font-size: 18px;
  color: cyan;
  text-shadow: 0 0 10px cyan;
  animation: pulse 1.5s ease-in-out infinite;
  margin: 0;
}

.sub-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.over-title {
  font-size: 32px;
  font-weight: bold;
  color: #ff4444;
  text-shadow: 0 0 15px #ff4444;
  margin: 0;
}

.final-score {
  font-size: 22px;
  color: white;
  margin: 0;
}

.best-score {
  font-size: 16px;
  color: rgba(0, 255, 255, 0.7);
  margin: 0;
}

.restart-btn {
  margin-top: 8px;
  padding: 10px 32px;
  font-size: 16px;
  font-weight: bold;
  color: #0a0a0a;
  background: cyan;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 1px;
}

.restart-btn:hover {
  background: #00e6e6;
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
  transform: scale(1.05);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
