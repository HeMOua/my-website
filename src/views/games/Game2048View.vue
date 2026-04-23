<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ========== 游戏状态 ==========
const SIZE = 4
const grid = ref<number[][]>(createEmptyGrid())
const score = ref(0)
const bestScore = ref(0)
const gameOver = ref(false)
const won = ref(false)
const keepPlaying = ref(false)

// 动画追踪
const newTilePos = ref<{ r: number; c: number } | null>(null)
const mergedPositions = ref<Set<string>>(new Set())

// 触摸追踪
let touchStartX = 0
let touchStartY = 0

function createEmptyGrid(): number[][] {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function cloneGrid(g: number[][]): number[][] {
  return g.map(row => [...row])
}

function emptyPositions(g: number[][]): { r: number; c: number }[] {
  const positions: { r: number; c: number }[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) positions.push({ r, c })
    }
  }
  return positions
}

function addRandomTile() {
  const empties = emptyPositions(grid.value)
  if (empties.length === 0) return
  const pos = empties[Math.floor(Math.random() * empties.length)]
  grid.value[pos.r][pos.c] = Math.random() < 0.9 ? 2 : 4
  newTilePos.value = pos
  setTimeout(() => {
    newTilePos.value = null
  }, 200)
}

function canMove(): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid.value[r][c] === 0) return true
      if (c < SIZE - 1 && grid.value[r][c] === grid.value[r][c + 1]) return true
      if (r < SIZE - 1 && grid.value[r][c] === grid.value[r + 1][c]) return true
    }
  }
  return false
}

// ========== 滑动与合并逻辑 ==========
function slideRow(row: number[]): { newRow: number[]; mergeScore: number; mergedIndices: number[] } {
  // 去除零值
  const filtered = row.filter(v => v !== 0)
  const merged: number[] = []
  const mergedIndices: number[] = []
  let mergeScore = 0
  let i = 0

  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2
      merged.push(val)
      mergedIndices.push(merged.length - 1)
      mergeScore += val
      i += 2
    } else {
      merged.push(filtered[i])
      i++
    }
  }

  // 补零
  while (merged.length < SIZE) {
    merged.push(0)
  }

  return { newRow: merged, mergeScore, mergedIndices }
}

function move(direction: 'up' | 'down' | 'left' | 'right') {
  if (gameOver.value) return
  if (won.value && !keepPlaying.value) return

  const oldGrid = cloneGrid(grid.value)
  let totalMergeScore = 0
  const newMerged = new Set<string>()

  if (direction === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const { newRow, mergeScore, mergedIndices } = slideRow(grid.value[r])
      grid.value[r] = newRow
      totalMergeScore += mergeScore
      mergedIndices.forEach(c => newMerged.add(`${r},${c}`))
    }
  } else if (direction === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const { newRow, mergeScore, mergedIndices } = slideRow([...grid.value[r]].reverse())
      grid.value[r] = newRow.reverse()
      totalMergeScore += mergeScore
      mergedIndices.forEach(c => newMerged.add(`${r},${SIZE - 1 - c}`))
    }
  } else if (direction === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = grid.value.map(row => row[c])
      const { newRow, mergeScore, mergedIndices } = slideRow(col)
      for (let r = 0; r < SIZE; r++) grid.value[r][c] = newRow[r]
      totalMergeScore += mergeScore
      mergedIndices.forEach(r => newMerged.add(`${r},${c}`))
    }
  } else if (direction === 'down') {
    for (let c = 0; c < SIZE; c++) {
      const col = grid.value.map(row => row[c]).reverse()
      const { newRow, mergeScore, mergedIndices } = slideRow(col)
      const reversed = newRow.reverse()
      for (let r = 0; r < SIZE; r++) grid.value[r][c] = reversed[r]
      totalMergeScore += mergeScore
      mergedIndices.forEach(r => newMerged.add(`${SIZE - 1 - r},${c}`))
    }
  }

  // 检查是否有变化
  let changed = false
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid.value[r][c] !== oldGrid[r][c]) {
        changed = true
        break
      }
    }
    if (changed) break
  }

  if (!changed) return

  // 更新分数
  score.value += totalMergeScore
  mergedPositions.value = newMerged
  setTimeout(() => {
    mergedPositions.value = new Set()
  }, 200)

  // 添加新方块
  addRandomTile()

  // 检查是否达到2048
  if (!won.value && !keepPlaying.value) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid.value[r][c] === 2048) {
          won.value = true
        }
      }
    }
  }

  // 检查游戏是否结束
  if (!canMove()) {
    gameOver.value = true
    saveBest()
  }
}

// ========== 分数管理 ==========
function loadBest() {
  bestScore.value = Number(localStorage.getItem('game2048-best') || 0)
}

function saveBest() {
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('game2048-best', String(bestScore.value))
  }
}

// ========== 游戏控制 ==========
function restart() {
  grid.value = createEmptyGrid()
  score.value = 0
  gameOver.value = false
  won.value = false
  keepPlaying.value = false
  newTilePos.value = null
  mergedPositions.value = new Set()
  addRandomTile()
  addRandomTile()
}

function continueGame() {
  keepPlaying.value = true
  won.value = false
}

// ========== 方块颜色 ==========
function tileColor(val: number): string {
  const colors: Record<number, string> = {
    2:    'rgba(0, 255, 255, 0.08)',
    4:    'rgba(0, 255, 255, 0.14)',
    8:    'rgba(0, 255, 255, 0.22)',
    16:   'rgba(0, 255, 255, 0.32)',
    32:   'rgba(0, 230, 255, 0.42)',
    64:   'rgba(0, 210, 255, 0.52)',
    128:  'rgba(0, 190, 255, 0.62)',
    256:  'rgba(0, 170, 240, 0.72)',
    512:  'rgba(0, 150, 230, 0.80)',
    1024: 'rgba(50, 200, 255, 0.88)',
    2048: 'rgba(255, 215, 0, 0.92)',
  }
  return colors[val] || 'rgba(255, 215, 0, 0.95)'
}

function tileTextColor(val: number): string {
  if (val <= 4) return 'rgba(0, 255, 255, 0.7)'
  if (val <= 64) return 'rgba(0, 255, 255, 0.9)'
  if (val <= 512) return '#ffffff'
  if (val === 2048) return '#1a1a1a'
  return '#1a1a1a'
}

function tileGlow(val: number): string {
  if (val >= 2048) return '0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.3)'
  if (val >= 1024) return '0 0 15px rgba(50, 200, 255, 0.5), 0 0 30px rgba(0, 255, 255, 0.2)'
  if (val >= 256) return '0 0 10px rgba(0, 170, 240, 0.4)'
  if (val >= 64) return '0 0 8px rgba(0, 210, 255, 0.3)'
  return 'none'
}

function isNewTile(r: number, c: number): boolean {
  return newTilePos.value !== null && newTilePos.value.r === r && newTilePos.value.c === c
}

function isMerged(r: number, c: number): boolean {
  return mergedPositions.value.has(`${r},${c}`)
}

// ========== 键盘与触摸 ==========
function onKeydown(e: KeyboardEvent) {
  const keyMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    W: 'up',
    S: 'down',
    A: 'left',
    D: 'right',
  }
  const dir = keyMap[e.key]
  if (dir) {
    e.preventDefault()
    move(dir)
  }
}

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (Math.max(absDx, absDy) < 30) return // 忽略太短的滑动

  if (absDx > absDy) {
    move(dx > 0 ? 'right' : 'left')
  } else {
    move(dy > 0 ? 'down' : 'up')
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  loadBest()
  restart()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="game-page">
    <!-- 顶部标题栏 -->
    <header class="game-header">
      <router-link to="/games" class="back-link">&larr; 返回</router-link>
      <h1 class="game-title">2048</h1>
      <div class="scores">
        <div class="score-box">
          <span class="score-label">分数</span>
          <span class="score-value">{{ score }}</span>
        </div>
        <div class="score-box">
          <span class="score-label">最高</span>
          <span class="score-value">{{ bestScore }}</span>
        </div>
      </div>
    </header>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button class="btn-restart" @click="restart">重新开始</button>
    </div>

    <!-- 游戏区域 -->
    <div
      class="game-board"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div class="grid-container">
        <!-- 背景格子 -->
        <div class="grid-bg">
          <div v-for="i in SIZE * SIZE" :key="'bg-' + i" class="cell-bg"></div>
        </div>
        <!-- 方块层 -->
        <div class="tiles-layer">
          <div
            v-for="(row, r) in grid"
            :key="'row-' + r"
            class="tile-row"
          >
            <div
              v-for="(val, c) in row"
              :key="'tile-' + r + '-' + c"
              class="tile"
              :class="{
                'tile-new': isNewTile(r, c),
                'tile-merged': isMerged(r, c),
                'tile-empty': val === 0,
              }"
              :style="{
                backgroundColor: val ? tileColor(val) : 'transparent',
                color: tileTextColor(val),
                boxShadow: val ? tileGlow(val) : 'none',
              }"
            >
              <span v-if="val" class="tile-num">{{ val }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 游戏结束遮罩 -->
      <div v-if="gameOver" class="overlay">
        <div class="overlay-content">
          <div class="overlay-title">Game Over</div>
          <div class="overlay-score">得分: {{ score }}</div>
          <button class="btn-overlay" @click="restart">重新开始</button>
        </div>
      </div>

      <!-- 胜利遮罩 -->
      <div v-if="won && !keepPlaying" class="overlay overlay-win">
        <div class="overlay-content">
          <div class="overlay-title">You Win!</div>
          <div class="overlay-score">得分: {{ score }}</div>
          <div class="overlay-buttons">
            <button class="btn-overlay" @click="continueGame">继续挑战</button>
            <button class="btn-overlay btn-secondary" @click="restart">重新开始</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作提示 -->
    <div class="controls-hint">
      <span>方向键 / WASD / 触摸滑动 控制方向</span>
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
  color: #fff;
  padding: 20px;
  user-select: none;
}

/* ===== 顶部标题栏 ===== */
.game-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
  width: 100%;
  max-width: 420px;
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
  text-shadow: 0 0 8px rgba(0, 255, 255, 0.5);
}

.game-title {
  font-size: 28px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan, 0 0 40px rgba(0, 255, 255, 0.3);
  margin: 0;
  flex: 1;
}

.scores {
  display: flex;
  gap: 10px;
}

.score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 6px;
  min-width: 60px;
}

.score-label {
  font-size: 10px;
  color: rgba(0, 255, 255, 0.6);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.score-value {
  font-size: 16px;
  font-weight: bold;
  color: cyan;
  text-shadow: 0 0 6px rgba(0, 255, 255, 0.4);
}

/* ===== 操作按钮 ===== */
.action-bar {
  width: 100%;
  max-width: 420px;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.btn-restart {
  padding: 6px 16px;
  background: rgba(0, 255, 255, 0.08);
  border: 1px solid rgba(0, 255, 255, 0.25);
  border-radius: 6px;
  color: cyan;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 1px;
}

.btn-restart:hover {
  background: rgba(0, 255, 255, 0.18);
  border-color: rgba(0, 255, 255, 0.5);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.15);
}

/* ===== 游戏棋盘 ===== */
.game-board {
  position: relative;
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(0, 255, 255, 0.2);
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.05);
}

.grid-container {
  width: 100%;
  height: 100%;
  position: relative;
  padding: 8px;
  box-sizing: border-box;
}

.grid-bg {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
  height: 100%;
}

.cell-bg {
  background: rgba(0, 255, 255, 0.04);
  border-radius: 6px;
  border: 1px solid rgba(0, 255, 255, 0.06);
}

.tiles-layer {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tile-row {
  flex: 1;
  display: flex;
  gap: 8px;
}

.tile {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-weight: bold;
  transition: background-color 0.15s, box-shadow 0.15s;
}

.tile-empty {
  background: transparent !important;
  box-shadow: none !important;
}

.tile-num {
  font-size: clamp(16px, 4vw, 28px);
  font-weight: 800;
  letter-spacing: 1px;
}

/* 新方块出现动画 */
.tile-new {
  animation: tileAppear 0.2s ease-out;
}

@keyframes tileAppear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 合并动画 */
.tile-merged {
  animation: tileMerge 0.2s ease-out;
}

@keyframes tileMerge {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

/* ===== 遮罩层 ===== */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 10;
  animation: overlayFadeIn 0.3s ease;
}

.overlay-win {
  background: rgba(0, 40, 40, 0.75);
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.overlay-content {
  text-align: center;
}

.overlay-title {
  font-size: 36px;
  font-weight: bold;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan;
  margin-bottom: 12px;
}

.overlay-win .overlay-title {
  color: gold;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.3);
}

.overlay-score {
  font-size: 18px;
  opacity: 0.8;
  margin-bottom: 20px;
}

.overlay-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-overlay {
  padding: 10px 24px;
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 8px;
  color: cyan;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 1px;
}

.btn-overlay:hover {
  background: rgba(0, 255, 255, 0.25);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* ===== 底部提示 ===== */
.controls-hint {
  margin-top: 16px;
  font-size: 13px;
  opacity: 0.4;
  letter-spacing: 1px;
}
</style>
