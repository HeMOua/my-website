<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// 4x4 grid: values 1-15, 0 = empty
const tiles = ref<number[]>([])
const moves = ref(0)
const timer = ref(0)
const isRunning = ref(false)
const isComplete = ref(false)
let timerInterval: ReturnType<typeof setInterval> | null = null

// Goal state: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0]
const goalState = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]

function getEmptyIndex(): number {
  return tiles.value.indexOf(0)
}

function getRow(index: number): number {
  return Math.floor(index / 4)
}

function getCol(index: number): number {
  return index % 4
}

function isAdjacent(index: number): boolean {
  const emptyIdx = getEmptyIndex()
  const rowDiff = Math.abs(getRow(index) - getRow(emptyIdx))
  const colDiff = Math.abs(getCol(index) - getCol(emptyIdx))
  return (rowDiff + colDiff) === 1
}

function moveTile(index: number) {
  if (isComplete.value) return
  if (!isAdjacent(index)) return

  const emptyIdx = getEmptyIndex()
  const newTiles = [...tiles.value]
  newTiles[emptyIdx] = newTiles[index]
  newTiles[index] = 0
  tiles.value = newTiles
  moves.value++

  if (!isRunning.value) {
    startTimer()
  }

  checkComplete()
}

function checkComplete() {
  if (tiles.value.every((val, idx) => val === goalState[idx])) {
    isComplete.value = true
    stopTimer()
  }
}

// Solvability check for 15-puzzle
function countInversions(arr: number[]): number {
  let inversions = 0
  const filtered = arr.filter(n => n !== 0)
  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < filtered.length; j++) {
      if (filtered[i] > filtered[j]) inversions++
    }
  }
  return inversions
}

function isSolvable(arr: number[]): boolean {
  const inversions = countInversions(arr)
  const emptyRow = getRow(arr.indexOf(0))
  // Row from bottom (1-indexed)
  const emptyRowFromBottom = 4 - emptyRow
  // For 4x4: solvable if (empty on odd row from bottom AND even inversions)
  // or (empty on even row from bottom AND odd inversions)
  if (emptyRowFromBottom % 2 === 1) {
    return inversions % 2 === 0
  } else {
    return inversions % 2 === 1
  }
}

function shuffle() {
  resetGame()
  let arr: number[]
  do {
    arr = [...goalState]
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
  } while (!isSolvable(arr) || arr.every((val, idx) => val === goalState[idx]))

  tiles.value = arr
}

function resetGame() {
  stopTimer()
  tiles.value = [...goalState]
  moves.value = 0
  timer.value = 0
  isRunning.value = false
  isComplete.value = false
}

function startTimer() {
  isRunning.value = true
  timerInterval = setInterval(() => {
    timer.value++
  }, 1000)
}

function stopTimer() {
  isRunning.value = false
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Keyboard support
function handleKeydown(e: KeyboardEvent) {
  if (isComplete.value) return

  const emptyIdx = getEmptyIndex()
  const emptyRow = getRow(emptyIdx)
  const emptyCol = getCol(emptyIdx)
  let targetIdx = -1

  switch (e.key) {
    case 'ArrowUp':
      // Move tile below empty up
      if (emptyRow < 3) targetIdx = emptyIdx + 4
      break
    case 'ArrowDown':
      // Move tile above empty down
      if (emptyRow > 0) targetIdx = emptyIdx - 4
      break
    case 'ArrowLeft':
      // Move tile right of empty left
      if (emptyCol < 3) targetIdx = emptyIdx + 1
      break
    case 'ArrowRight':
      // Move tile left of empty right
      if (emptyCol > 0) targetIdx = emptyIdx - 1
      break
    default:
      return
  }

  if (targetIdx >= 0 && targetIdx < 16) {
    e.preventDefault()
    moveTile(targetIdx)
  }
}

// Tile color based on value
function getTileStyle(value: number): Record<string, string> {
  if (value === 0) return {}
  const hue = ((value - 1) / 14) * 160 + 170 // 170 (cyan range) to 330 (pink range)
  const saturation = 80
  const lightness = 45
  return {
    background: `linear-gradient(135deg, hsl(${hue}, ${saturation}%, ${lightness}%), hsl(${hue + 20}, ${saturation}%, ${lightness - 10}%))`,
    boxShadow: `0 0 12px hsla(${hue}, ${saturation}%, ${lightness}%, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)`,
  }
}

// Track tile positions for animation
const tilePositions = computed(() => {
  const positions: Record<number, { row: number; col: number }> = {}
  tiles.value.forEach((val, idx) => {
    positions[val] = { row: getRow(idx), col: getCol(idx) }
  })
  return positions
})

onMounted(() => {
  shuffle()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopTimer()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back-btn">&larr; 游戏大厅</router-link>
      <h1 class="game-title">拼图 15</h1>
      <div class="stats-board">
        <div class="stat-item">
          <span class="stat-label">步数</span>
          <span class="stat-value">{{ moves }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">时间</span>
          <span class="stat-value">{{ formatTime(timer) }}</span>
        </div>
      </div>
    </header>

    <div class="game-area">
      <!-- Complete overlay -->
      <div v-if="isComplete" class="complete-overlay">
        <div class="complete-card">
          <div class="complete-icon">&#127942;</div>
          <h2 class="complete-title">恭喜完成!</h2>
          <div class="complete-stats">
            <div class="complete-stat">
              <span class="complete-stat-label">步数</span>
              <span class="complete-stat-value">{{ moves }}</span>
            </div>
            <div class="complete-stat">
              <span class="complete-stat-label">用时</span>
              <span class="complete-stat-value">{{ formatTime(timer) }}</span>
            </div>
          </div>
          <button class="btn btn-primary" @click="shuffle">再来一局</button>
        </div>
      </div>

      <div class="puzzle-container">
        <div class="puzzle-grid">
          <div
            v-for="(value, index) in tiles"
            :key="value === 0 ? `empty-${index}` : `tile-${value}`"
            class="tile-wrapper"
            :style="{
              gridRow: getRow(index) + 1,
              gridColumn: getCol(index) + 1,
            }"
          >
            <div
              v-if="value !== 0"
              class="tile"
              :class="{ 'tile-movable': isAdjacent(index) && !isComplete }"
              :style="getTileStyle(value)"
              @click="moveTile(index)"
            >
              {{ value }}
            </div>
            <div v-else class="tile-empty"></div>
          </div>
        </div>
      </div>

      <div class="controls">
        <button class="btn btn-primary" @click="shuffle">
          打乱
        </button>
        <button class="btn btn-secondary" @click="resetGame">
          重置
        </button>
      </div>
    </div>

    <footer class="game-footer">
      <p>点击相邻方块或使用 <span class="hint-key">方向键</span> 移动 | 将数字 1-15 按顺序排列</p>
    </footer>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0a0a;
  padding: 24px 32px;
}

/* Header */
.game-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}

.back-btn {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s;
  white-space: nowrap;
}

.back-btn:hover {
  opacity: 1;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.game-title {
  font-size: 28px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan;
  flex: 1;
}

.stats-board {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: cyan;
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.15);
}

/* Game Area */
.game-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  position: relative;
}

/* Puzzle Container */
.puzzle-container {
  position: relative;
}

.puzzle-grid {
  display: grid;
  grid-template-columns: repeat(4, 80px);
  grid-template-rows: repeat(4, 80px);
  gap: 4px;
  padding: 8px;
  background: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 255, 255, 0.08));
  border-radius: 12px;
  box-shadow:
    0 0 24px rgba(0, 255, 255, 0.12),
    0 0 48px rgba(0, 255, 255, 0.04),
    inset 0 0 16px rgba(0, 255, 255, 0.04);
}

.tile-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tile {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 24px;
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  user-select: none;
  position: relative;
}

.tile::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.tile-movable:hover {
  transform: scale(1.05);
  z-index: 2;
  filter: brightness(1.2);
}

.tile-movable:active {
  transform: scale(0.95);
}

.tile-empty {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px dashed rgba(0, 255, 255, 0.1);
}

/* Complete Overlay */
.complete-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  border-radius: 12px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.complete-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 0 40px rgba(0, 255, 255, 0.15);
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.complete-icon {
  font-size: 48px;
}

.complete-title {
  font-size: 24px;
  color: cyan;
  text-shadow: 0 0 16px rgba(0, 255, 255, 0.5);
  letter-spacing: 2px;
}

.complete-stats {
  display: flex;
  gap: 32px;
}

.complete-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.complete-stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.complete-stat-value {
  font-size: 28px;
  font-weight: bold;
  color: cyan;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

/* Controls */
.controls {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.btn {
  padding: 10px 28px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  letter-spacing: 1px;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, cyan, #00b8b8);
  color: #000;
  box-shadow: 0 0 16px rgba(0, 255, 255, 0.3);
}

.btn-primary:hover {
  box-shadow: 0 0 24px rgba(0, 255, 255, 0.5);
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
}

/* Footer */
.game-footer {
  margin-top: 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.hint-key {
  color: cyan;
  font-weight: bold;
}
</style>
