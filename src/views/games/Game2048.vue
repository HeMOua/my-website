<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'

type Grid = number[][]

const SIZE = 4

const grid = reactive<Grid>(createEmptyGrid())
const score = ref(0)
const bestScore = ref(loadBestScore())
const gameOver = ref(false)
const won = ref(false)
const keepPlaying = ref(false)

// 用于动画追踪
const mergedCells = reactive<Set<string>>(new Set())
const newCell = ref<string | null>(null)

function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function cloneGrid(g: Grid): Grid {
  return g.map(row => [...row])
}

function loadBestScore(): number {
  return parseInt(localStorage.getItem('game2048_best') || '0', 10)
}

function saveBestScore() {
  if (score.value > bestScore.value) {
    bestScore.value = score.value
    localStorage.setItem('game2048_best', String(bestScore.value))
  }
}

function getEmptyCells(g: Grid): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) cells.push([r, c])
    }
  }
  return cells
}

function addRandomTile(g: Grid): [number, number] | null {
  const empty = getEmptyCells(g)
  if (empty.length === 0) return null
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  g[r][c] = Math.random() < 0.9 ? 2 : 4
  return [r, c]
}

// 将一行向左滑动合并，返回 [新行, 本次得分, 合并位置集合]
function slideRow(row: number[]): { newRow: number[]; rowScore: number; merged: boolean[] } {
  const filtered = row.filter(v => v !== 0)
  const newRow: number[] = []
  const merged: boolean[] = Array(SIZE).fill(false)
  let rowScore = 0
  let i = 0

  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2
      newRow.push(val)
      rowScore += val
      merged[newRow.length - 1] = true
      i += 2
    } else {
      newRow.push(filtered[i])
      i++
    }
  }

  while (newRow.length < SIZE) {
    newRow.push(0)
  }

  return { newRow, rowScore, merged }
}

function rotateGrid(g: Grid): Grid {
  const result = createEmptyGrid()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      result[c][SIZE - 1 - r] = g[r][c]
    }
  }
  return result
}

function rotateMerged(merged: boolean[][], times: number): boolean[][] {
  let result = merged.map(row => [...row])
  for (let t = 0; t < times; t++) {
    const rotated: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false))
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        rotated[c][SIZE - 1 - r] = result[r][c]
      }
    }
    result = rotated
  }
  return result
}

function move(direction: 'left' | 'right' | 'up' | 'down') {
  if (gameOver.value) return

  // 旋转次数: left=0, up=1, right=2, down=3
  const rotations: Record<string, number> = { left: 0, up: 1, right: 2, down: 3 }
  const times = rotations[direction]

  let g = cloneGrid(grid)
  for (let i = 0; i < times; i++) g = rotateGrid(g)

  let mergedPositions: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false))
  let totalScore = 0
  let moved = false

  for (let r = 0; r < SIZE; r++) {
    const { newRow, rowScore, merged } = slideRow(g[r])
    if (newRow.some((v, i) => v !== g[r][i])) moved = true
    g[r] = newRow
    totalScore += rowScore
    mergedPositions[r] = merged
  }

  if (!moved) return

  // 旋转回来
  for (let i = 0; i < (4 - times) % 4; i++) g = rotateGrid(g)
  mergedPositions = rotateMerged(mergedPositions, (4 - times) % 4)

  // 更新合并标记
  mergedCells.clear()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (mergedPositions[r][c]) mergedCells.add(`${r}-${c}`)
    }
  }

  // 添加新方块
  const added = addRandomTile(g)
  newCell.value = added ? `${added[0]}-${added[1]}` : null

  // 更新网格
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      grid[r][c] = g[r][c]
    }
  }

  score.value += totalScore
  saveBestScore()

  // 检查胜利
  if (!won.value && !keepPlaying.value) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 2048) {
          won.value = true
          return
        }
      }
    }
  }

  // 检查游戏结束
  if (isGameOver()) {
    gameOver.value = true
  }

  // 清除动画标记
  setTimeout(() => {
    mergedCells.clear()
    newCell.value = null
  }, 200)
}

function isGameOver(): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return false
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return false
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return false
    }
  }
  return true
}

function restart() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      grid[r][c] = 0
    }
  }
  score.value = 0
  gameOver.value = false
  won.value = false
  keepPlaying.value = false
  mergedCells.clear()
  newCell.value = null
  addRandomTile(grid)
  addRandomTile(grid)
}

function continueGame() {
  keepPlaying.value = true
  won.value = false
}

function handleKeydown(e: KeyboardEvent) {
  const map: Record<string, 'left' | 'right' | 'up' | 'down'> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  }
  const dir = map[e.key]
  if (dir) {
    e.preventDefault()
    move(dir)
  }
}

// 触摸支持
let touchStartX = 0
let touchStartY = 0

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function handleTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (Math.max(absDx, absDy) < 30) return

  if (absDx > absDy) {
    move(dx > 0 ? 'right' : 'left')
  } else {
    move(dy > 0 ? 'down' : 'up')
  }
}

function getCellClass(r: number, c: number): Record<string, boolean> {
  const key = `${r}-${c}`
  return {
    merged: mergedCells.has(key),
    'new-tile': newCell.value === key,
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  restart()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    class="game-2048"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <header class="header">
      <router-link to="/games" class="back-link">&larr; 游戏大厅</router-link>
      <h1 class="title">2048</h1>
    </header>

    <div class="score-bar">
      <div class="score-box">
        <span class="score-label">SCORE</span>
        <span class="score-value">{{ score }}</span>
      </div>
      <div class="score-box">
        <span class="score-label">BEST</span>
        <span class="score-value">{{ bestScore }}</span>
      </div>
      <button class="btn-restart" @click="restart">重新开始</button>
    </div>

    <div class="board-wrapper">
      <div class="board">
        <div v-for="(row, r) in grid" :key="r" class="row">
          <div
            v-for="(cell, c) in row"
            :key="c"
            class="cell"
            :class="[`val-${cell}`, getCellClass(r, c)]"
          >
            <span v-if="cell" class="cell-text">{{ cell }}</span>
          </div>
        </div>
      </div>

      <!-- 游戏结束遮罩 -->
      <div v-if="gameOver" class="overlay">
        <div class="overlay-content">
          <div class="overlay-title">GAME OVER</div>
          <div class="overlay-score">最终得分: {{ score }}</div>
          <button class="btn-overlay" @click="restart">再来一局</button>
        </div>
      </div>

      <!-- 胜利遮罩 -->
      <div v-if="won && !keepPlaying" class="overlay win-overlay">
        <div class="overlay-content">
          <div class="overlay-title win-title">YOU WIN!</div>
          <div class="overlay-score">得分: {{ score }}</div>
          <div class="overlay-buttons">
            <button class="btn-overlay" @click="continueGame">继续挑战</button>
            <button class="btn-overlay btn-secondary" @click="restart">重新开始</button>
          </div>
        </div>
      </div>
    </div>

    <div class="hint">使用方向键或触摸滑动操作</div>
  </div>
</template>

<style scoped>
.game-2048 {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  background: #0a0a0a;
  color: #fff;
  user-select: none;
  -webkit-user-select: none;
}

.header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
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
}

.title {
  font-size: 36px;
  font-weight: 900;
  letter-spacing: 6px;
  text-shadow: 0 0 30px rgba(0, 255, 255, 0.6), 0 0 60px rgba(0, 255, 255, 0.3);
  margin: 0;
  flex: 1;
  text-align: center;
}

.score-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 420px;
}

.score-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 8px;
}

.score-label {
  font-size: 11px;
  letter-spacing: 2px;
  color: rgba(0, 255, 255, 0.6);
}

.score-value {
  font-size: 22px;
  font-weight: bold;
  color: cyan;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.4);
}

.btn-restart {
  padding: 10px 16px;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 8px;
  color: cyan;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.btn-restart:hover {
  background: rgba(0, 255, 255, 0.2);
  border-color: rgba(0, 255, 255, 0.6);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
}

.board-wrapper {
  position: relative;
  width: 100%;
  max-width: 420px;
}

.board {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 255, 255, 0.04);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(0, 255, 255, 0.05), inset 0 0 30px rgba(0, 0, 0, 0.5);
}

.row {
  display: flex;
  gap: 8px;
}

.cell {
  flex: 1;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.15s ease;
  position: relative;
}

.cell-text {
  font-weight: 800;
  line-height: 1;
  transition: transform 0.15s ease;
}

/* 数字颜色 */
.cell.val-2 {
  background: rgba(0, 180, 180, 0.2);
  border-color: rgba(0, 180, 180, 0.3);
}
.cell.val-2 .cell-text {
  color: #5eeede;
  font-size: 28px;
}

.cell.val-4 {
  background: rgba(0, 255, 255, 0.2);
  border-color: rgba(0, 255, 255, 0.35);
}
.cell.val-4 .cell-text {
  color: #00ffff;
  font-size: 28px;
}

.cell.val-8 {
  background: rgba(255, 165, 0, 0.25);
  border-color: rgba(255, 165, 0, 0.4);
}
.cell.val-8 .cell-text {
  color: #ffa500;
  font-size: 28px;
  text-shadow: 0 0 8px rgba(255, 165, 0, 0.4);
}

.cell.val-16 {
  background: rgba(255, 100, 0, 0.25);
  border-color: rgba(255, 100, 0, 0.4);
}
.cell.val-16 .cell-text {
  color: #ff6400;
  font-size: 26px;
  text-shadow: 0 0 8px rgba(255, 100, 0, 0.4);
}

.cell.val-32 {
  background: rgba(255, 50, 50, 0.25);
  border-color: rgba(255, 50, 50, 0.4);
}
.cell.val-32 .cell-text {
  color: #ff3232;
  font-size: 26px;
  text-shadow: 0 0 10px rgba(255, 50, 50, 0.4);
}

.cell.val-64 {
  background: rgba(200, 0, 0, 0.3);
  border-color: rgba(200, 0, 0, 0.5);
}
.cell.val-64 .cell-text {
  color: #ff1a1a;
  font-size: 26px;
  text-shadow: 0 0 12px rgba(255, 0, 0, 0.5);
}

.cell.val-128 {
  background: rgba(255, 215, 0, 0.25);
  border-color: rgba(255, 215, 0, 0.4);
}
.cell.val-128 .cell-text {
  color: #ffd700;
  font-size: 22px;
  text-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.cell.val-256 {
  background: rgba(255, 223, 0, 0.3);
  border-color: rgba(255, 223, 0, 0.5);
}
.cell.val-256 .cell-text {
  color: #ffdf00;
  font-size: 22px;
  text-shadow: 0 0 15px rgba(255, 223, 0, 0.6);
}

.cell.val-512 {
  background: rgba(160, 32, 240, 0.25);
  border-color: rgba(160, 32, 240, 0.4);
}
.cell.val-512 .cell-text {
  color: #c060ff;
  font-size: 22px;
  text-shadow: 0 0 12px rgba(160, 32, 240, 0.5);
}

.cell.val-1024 {
  background: rgba(100, 50, 220, 0.3);
  border-color: rgba(100, 50, 220, 0.5);
}
.cell.val-1024 .cell-text {
  color: #9070ff;
  font-size: 18px;
  text-shadow: 0 0 15px rgba(100, 50, 220, 0.6);
}

.cell.val-2048 {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1);
}
.cell.val-2048 .cell-text {
  color: #ffffff;
  font-size: 18px;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.5);
}

/* 超过2048的方块 */
.cell.val-4096,
.cell.val-8192 {
  background: rgba(0, 255, 255, 0.3);
  border-color: rgba(0, 255, 255, 0.6);
  box-shadow: 0 0 25px rgba(0, 255, 255, 0.3);
}
.cell.val-4096 .cell-text,
.cell.val-8192 .cell-text {
  color: #00ffff;
  font-size: 16px;
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
}

/* 合并动画 */
.cell.merged .cell-text {
  animation: pop 0.2s ease;
}

@keyframes pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

/* 新方块出现动画 */
.cell.new-tile .cell-text {
  animation: appear 0.2s ease;
}

@keyframes appear {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 遮罩层 */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 12px;
  z-index: 10;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.overlay-title {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: 4px;
  color: #ff3232;
  text-shadow: 0 0 20px rgba(255, 50, 50, 0.6);
}

.win-title {
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(0, 255, 255, 0.3);
}

.overlay-score {
  font-size: 16px;
  opacity: 0.8;
}

.overlay-buttons {
  display: flex;
  gap: 12px;
}

.btn-overlay {
  padding: 10px 24px;
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 8px;
  color: cyan;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-overlay:hover {
  background: rgba(0, 255, 255, 0.25);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

.hint {
  margin-top: 20px;
  font-size: 13px;
  color: rgba(0, 255, 255, 0.4);
  letter-spacing: 1px;
}

/* 响应式 */
@media (max-width: 480px) {
  .game-2048 {
    padding: 16px 8px;
  }

  .title {
    font-size: 28px;
  }

  .board {
    padding: 8px;
    gap: 6px;
  }

  .row {
    gap: 6px;
  }

  .cell {
    border-radius: 6px;
  }

  .cell.val-2 .cell-text,
  .cell.val-4 .cell-text,
  .cell.val-8 .cell-text {
    font-size: 24px;
  }

  .cell.val-16 .cell-text,
  .cell.val-32 .cell-text,
  .cell.val-64 .cell-text {
    font-size: 22px;
  }

  .cell.val-128 .cell-text,
  .cell.val-256 .cell-text,
  .cell.val-512 .cell-text {
    font-size: 18px;
  }

  .cell.val-1024 .cell-text,
  .cell.val-2048 .cell-text {
    font-size: 14px;
  }
}
</style>
