<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const SIZE = 4
const TILE_SIZE = 80
const GAP = 4

const board = ref<number[]>([])
const moves = ref(0)
const timerSeconds = ref(0)
const won = ref(false)
const shuffling = ref(false)

let timerInterval: number | null = null
let timerStarted = false

// Initialize to solved state: [1, 2, 3, ..., 15, 0]
function initSolved(): number[] {
  const arr: number[] = []
  for (let i = 1; i < SIZE * SIZE; i++) arr.push(i)
  arr.push(0)
  return arr
}

// Find the index of the empty space
function getEmptyIndex(): number {
  return board.value.indexOf(0)
}

// Get row and col from index
function toRowCol(index: number): [number, number] {
  return [Math.floor(index / SIZE), index % SIZE]
}

// Check if two indices are adjacent (Manhattan distance = 1)
function isAdjacent(i: number, j: number): boolean {
  const [r1, c1] = toRowCol(i)
  const [r2, c2] = toRowCol(j)
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1
}

// Swap two positions on the board
function swap(i: number, j: number) {
  const arr = [...board.value]
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
  board.value = arr
}

// Check if the puzzle is in the solved state
function checkWin(): boolean {
  for (let i = 0; i < SIZE * SIZE - 1; i++) {
    if (board.value[i] !== i + 1) return false
  }
  return board.value[SIZE * SIZE - 1] === 0
}

// Start the timer (only once per game)
function startTimer() {
  if (timerStarted) return
  timerStarted = true
  timerInterval = window.setInterval(() => {
    timerSeconds.value++
  }, 1000)
}

// Stop the timer
function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerStarted = false
}

// Format seconds as mm:ss
const formattedTime = computed(() => {
  const m = Math.floor(timerSeconds.value / 60)
  const s = timerSeconds.value % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

// Handle clicking a tile
function clickTile(index: number) {
  if (won.value || shuffling.value) return
  if (board.value[index] === 0) return

  const ei = getEmptyIndex()
  if (!isAdjacent(index, ei)) return

  startTimer()
  swap(index, ei)
  moves.value++

  if (checkWin()) {
    won.value = true
    stopTimer()
  }
}

// Shuffle by making 250 random valid moves from the solved state
function shuffle() {
  stopTimer()
  stopCelebration()
  won.value = false
  moves.value = 0
  timerSeconds.value = 0
  timerStarted = false
  shuffling.value = true

  board.value = initSolved()

  let lastEmpty = getEmptyIndex()
  const totalMoves = 250

  for (let m = 0; m < totalMoves; m++) {
    const ei = getEmptyIndex()
    const [er, ec] = toRowCol(ei)

    // Collect valid neighbor indices, excluding the tile we just moved
    const neighbors: number[] = []
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dr, dc] of dirs) {
      const nr = er + dr
      const nc = ec + dc
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
        const ni = nr * SIZE + nc
        if (ni !== lastEmpty) {
          neighbors.push(ni)
        }
      }
    }

    // Pick a random neighbor and swap
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)]
    lastEmpty = ei
    swap(ei, pick)
  }

  // Guard: if somehow still solved, do a few more moves
  if (checkWin()) {
    for (let i = 0; i < 10; i++) {
      const ei = getEmptyIndex()
      const [er, ec] = toRowCol(ei)
      const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      const valid = dirs
        .map(([dr, dc]) => [er + dr, ec + dc] as [number, number])
        .filter(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE)
      const [nr, nc] = valid[Math.floor(Math.random() * valid.length)]
      swap(ei, nr * SIZE + nc)
    }
  }

  shuffling.value = false
}

// Compute the CSS transform for a tile at a given board index
function tileStyle(index: number) {
  const row = Math.floor(index / SIZE)
  const col = index % SIZE
  return {
    transform: `translate(${col * (TILE_SIZE + GAP)}px, ${row * (TILE_SIZE + GAP)}px)`,
  }
}

// Celebration particles
interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  angle: number
  speed: number
}

const particles = ref<Particle[]>([])
let particleId = 0
let particleInterval: number | null = null

function startCelebration() {
  particles.value = []
  const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff4466', '#ff8800', '#8844ff', '#44ffaa']
  particleInterval = window.setInterval(() => {
    for (let i = 0; i < 3; i++) {
      particles.value.push({
        id: particleId++,
        x: 40 + Math.random() * 280,
        y: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        angle: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 2,
      })
    }
    // Remove particles that have fallen off screen
    particles.value = particles.value.filter(p => p.y < 500)
  }, 60)
}

function stopCelebration() {
  if (particleInterval !== null) {
    clearInterval(particleInterval)
    particleInterval = null
  }
  particles.value = []
}

// Watch for win to trigger celebration
watch(won, (val) => {
  if (val) {
    startCelebration()
  } else {
    stopCelebration()
  }
})

onMounted(() => {
  shuffle()
})

onUnmounted(() => {
  stopTimer()
  stopCelebration()
})
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back">&larr; 返回游戏列表</router-link>
      <h1>15 拼图</h1>
    </header>

    <div class="stats">
      <div class="stat-item">
        <span class="stat-label">步数</span>
        <span class="stat-value">{{ moves }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">时间</span>
        <span class="stat-value">{{ formattedTime }}</span>
      </div>
    </div>

    <div class="board-wrapper">
      <!-- Celebration particles -->
      <div v-if="won" class="particles">
        <div
          v-for="p in particles"
          :key="p.id"
          class="particle"
          :style="{
            left: p.x + 'px',
            top: p.y + 'px',
            width: p.size + 'px',
            height: p.size + 'px',
            backgroundColor: p.color,
          }"
        />
      </div>

      <div
        class="board"
        :style="{
          width: SIZE * TILE_SIZE + (SIZE - 1) * GAP + 'px',
          height: SIZE * TILE_SIZE + (SIZE - 1) * GAP + 'px',
        }"
      >
        <div
          v-for="(value, index) in board"
          :key="value === 0 ? 'empty' : 'tile-' + value"
          class="tile"
          :class="{
            'tile--empty': value === 0,
            'tile--correct': value !== 0 && value === index + 1 && !won,
            'tile--won': won && value !== 0,
          }"
          :style="tileStyle(index)"
          @click="clickTile(index)"
        >
          {{ value !== 0 ? value : '' }}
        </div>
      </div>

      <!-- Win overlay -->
      <Transition name="fade">
        <div v-if="won" class="win-overlay">
          <div class="win-text">
            <div class="win-title">恭喜通关!</div>
            <div class="win-detail">{{ moves }} 步 &middot; {{ formattedTime }}</div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="btn-group">
      <button class="btn" @click="shuffle">重新打乱</button>
    </div>

    <div class="hint">点击与空格相邻的方块进行滑动</div>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #000;
  padding: 20px;
  color: #fff;
  font-family: 'Segoe UI', Arial, sans-serif;
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
  color: #00ffff;
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
  text-shadow: 0 0 15px #00ffff;
  flex: 1;
  margin: 0;
}

.stats {
  display: flex;
  gap: 40px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 20px;
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 8px;
}

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(0, 255, 255, 0.5);
}

.stat-value {
  font-size: 26px;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.4);
}

.board-wrapper {
  position: relative;
}

.board {
  position: relative;
  background: rgba(0, 255, 255, 0.03);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 8px;
}

.tile {
  position: absolute;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease;
  background: #1a1a2e;
  border: 2px solid #00ffff;
  color: #fff;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.15);
}

.tile:hover {
  background: #22223a;
  box-shadow: 0 0 16px rgba(0, 255, 255, 0.3);
}

.tile:active {
  background: #2a2a4e;
}

.tile--empty {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  cursor: default;
  pointer-events: none;
}

.tile--correct {
  border-color: rgba(0, 255, 100, 0.6);
  box-shadow: 0 0 8px rgba(0, 255, 100, 0.15);
}

.tile--won {
  border-color: #00ff88;
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
  animation: tilePulse 0.6s ease;
}

@keyframes tilePulse {
  0% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.4); }
  50% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.7); }
  100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.4); }
}

.particles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: 10;
}

.particle {
  position: absolute;
  border-radius: 50%;
  animation: particleFall 2s linear forwards;
}

@keyframes particleFall {
  0% {
    opacity: 1;
    transform: translateY(0) rotate(0deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(500px) rotate(720deg) scale(0.5);
  }
}

.win-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  z-index: 20;
}

.fade-enter-active {
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.win-text {
  text-align: center;
}

.win-title {
  font-size: 32px;
  font-weight: bold;
  color: #00ffff;
  text-shadow: 0 0 30px #00ffff, 0 0 60px rgba(0, 255, 255, 0.3);
  margin-bottom: 8px;
}

.win-detail {
  font-size: 16px;
  opacity: 0.8;
}

.btn-group {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 28px;
  font-size: 14px;
  background: rgba(0, 255, 255, 0.15);
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.25);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.2);
}

.hint {
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.4;
}
</style>
