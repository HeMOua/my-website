<script setup lang="ts">
import { ref, computed } from 'vue'

type CellValue = '' | 'X' | 'O'
type GameResult = CellValue | 'draw' | null

const board = ref<CellValue[]>(Array(9).fill(''))
const currentPlayer = ref<'X' | 'O'>('X')
const winner = ref<GameResult>(null)
const scoreX = ref(0)
const scoreO = ref(0)

const winLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // 行
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // 列
  [0, 4, 8], [2, 4, 6],             // 对角线
]

function checkWinner(b: CellValue[]): GameResult {
  for (const [a, bIdx, c] of winLines) {
    if (b[a] && b[a] === b[bIdx] && b[a] === b[c]) {
      return b[a]
    }
  }
  if (b.every(cell => cell !== '')) return 'draw'
  return null
}

const winLine = computed(() => {
  if (!winner.value || winner.value === 'draw') return null
  for (const line of winLines) {
    const [a, b, c] = line
    if (board.value[a] && board.value[a] === board.value[b] && board.value[a] === board.value[c]) {
      return line
    }
  }
  return null
})

function makeMove(index: number) {
  if (board.value[index] || winner.value) return
  board.value[index] = currentPlayer.value
  const result = checkWinner(board.value)
  if (result) {
    winner.value = result
    if (result === 'X') scoreX.value++
    else if (result === 'O') scoreO.value++
  } else {
    currentPlayer.value = currentPlayer.value === 'X' ? 'O' : 'X'
  }
}

function newGame() {
  board.value = Array(9).fill('')
  currentPlayer.value = 'X'
  winner.value = null
}

function resetScores() {
  newGame()
  scoreX.value = 0
  scoreO.value = 0
}

const statusText = computed(() => {
  if (winner.value === 'draw') return '平局!'
  if (winner.value === 'X') return 'X 获胜!'
  if (winner.value === 'O') return 'O 获胜!'
  return `轮到 ${currentPlayer.value}`
})

const statusClass = computed(() => {
  if (winner.value === 'draw') return 'draw'
  if (winner.value === 'X') return 'x-win'
  if (winner.value === 'O') return 'o-win'
  return currentPlayer.value === 'X' ? 'turn-x' : 'turn-o'
})

function isWinningCell(index: number): boolean {
  return winLine.value !== null && winLine.value.includes(index)
}
</script>

<template>
  <div class="game-page">
    <header class="game-header">
      <router-link to="/games" class="back-btn">&larr; 游戏大厅</router-link>
      <h1 class="game-title">井字棋</h1>
      <div class="score-board">
        <div class="score-item score-x">
          <span class="score-label">玩家 X</span>
          <span class="score-value">{{ scoreX }}</span>
        </div>
        <div class="score-divider">vs</div>
        <div class="score-item score-o">
          <span class="score-label">玩家 O</span>
          <span class="score-value">{{ scoreO }}</span>
        </div>
      </div>
    </header>

    <div class="game-area">
      <div class="status" :class="statusClass">{{ statusText }}</div>

      <div class="board">
        <div
          v-for="(cell, index) in board"
          :key="index"
          class="cell"
          :class="{
            'cell-x': cell === 'X',
            'cell-o': cell === 'O',
            'win-cell': isWinningCell(index),
            'win-cell-x': isWinningCell(index) && winner === 'X',
            'win-cell-o': isWinningCell(index) && winner === 'O',
            clickable: !cell && !winner,
          }"
          @click="makeMove(index)"
        >
          <span v-if="cell" class="mark">{{ cell }}</span>
        </div>
      </div>

      <div class="controls">
        <button class="btn btn-primary" @click="newGame">重新开始</button>
        <button class="btn btn-reset" @click="resetScores">重置比分</button>
      </div>
    </div>

    <footer class="game-footer">
      <p>点击空格放置标记 | X 用 <span class="hint-x">青色</span>，O 用 <span class="hint-o">粉色</span></p>
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
  color: #00ffff;
  text-shadow: 0 0 20px #00ffff;
  flex: 1;
}

.score-board {
  display: flex;
  align-items: center;
  gap: 20px;
}

.score-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.6;
}

.score-value {
  font-size: 28px;
  font-weight: bold;
}

.score-x .score-value {
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.score-o .score-value {
  color: #ff69b4;
  text-shadow: 0 0 10px rgba(255, 105, 180, 0.5);
}

.score-divider {
  font-size: 16px;
  opacity: 0.3;
  letter-spacing: 2px;
  align-self: flex-end;
  margin-bottom: 8px;
}

/* Game Area */
.game-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.status {
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 2px;
  padding: 8px 24px;
  border-radius: 8px;
  min-height: 30px;
  transition: all 0.3s;
  background: rgba(0, 255, 255, 0.06);
  border: 1px solid rgba(0, 255, 255, 0.15);
}

.status.turn-x {
  color: #00ffff;
  text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
  border-color: rgba(0, 255, 255, 0.3);
}

.status.turn-o {
  color: #ff69b4;
  text-shadow: 0 0 12px rgba(255, 105, 180, 0.6);
  border-color: rgba(255, 105, 180, 0.3);
  background: rgba(255, 105, 180, 0.06);
}

.status.x-win {
  color: #00ffff;
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4);
  background: rgba(0, 255, 255, 0.12);
  border-color: rgba(0, 255, 255, 0.5);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.status.o-win {
  color: #ff69b4;
  text-shadow: 0 0 20px rgba(255, 105, 180, 0.8), 0 0 40px rgba(255, 105, 180, 0.4);
  background: rgba(255, 105, 180, 0.12);
  border-color: rgba(255, 105, 180, 0.5);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.status.draw {
  color: #aaaaaa;
  text-shadow: 0 0 10px rgba(170, 170, 170, 0.4);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Board */
.board {
  display: grid;
  grid-template-columns: repeat(3, 100px);
  grid-template-rows: repeat(3, 100px);
  gap: 4px;
  padding: 4px;
  background: linear-gradient(135deg, rgba(0, 255, 255, 0.25), rgba(0, 255, 255, 0.08));
  border-radius: 12px;
  box-shadow:
    0 0 20px rgba(0, 255, 255, 0.15),
    0 0 40px rgba(0, 255, 255, 0.05),
    inset 0 0 20px rgba(0, 255, 255, 0.05);
}

.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
  border: 1px solid rgba(0, 255, 255, 0.08);
  border-radius: 8px;
  cursor: default;
  transition: all 0.2s;
  user-select: none;
}

.cell.clickable {
  cursor: pointer;
}

.cell.clickable:hover {
  background: #111;
  box-shadow: inset 0 0 15px rgba(0, 255, 255, 0.08);
  border-color: rgba(0, 255, 255, 0.2);
}

.mark {
  font-size: 48px;
  font-weight: bold;
  line-height: 1;
  transition: all 0.3s;
}

.cell-x .mark {
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.cell-o .mark {
  color: #ff69b4;
  text-shadow: 0 0 10px rgba(255, 105, 180, 0.5);
}

.cell.win-cell {
  background: #0d0d0d;
}

.cell.win-cell-x {
  box-shadow: inset 0 0 25px rgba(0, 255, 255, 0.15);
  border-color: rgba(0, 255, 255, 0.3);
}

.cell.win-cell-x .mark {
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4);
  animation: glow-x 1.5s ease-in-out infinite;
}

.cell.win-cell-o {
  box-shadow: inset 0 0 25px rgba(255, 105, 180, 0.15);
  border-color: rgba(255, 105, 180, 0.3);
}

.cell.win-cell-o .mark {
  text-shadow: 0 0 20px rgba(255, 105, 180, 0.8), 0 0 40px rgba(255, 105, 180, 0.4);
  animation: glow-o 1.5s ease-in-out infinite;
}

@keyframes glow-x {
  0%, 100% {
    text-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4);
  }
  50% {
    text-shadow: 0 0 30px rgba(0, 255, 255, 1), 0 0 60px rgba(0, 255, 255, 0.6);
  }
}

@keyframes glow-o {
  0%, 100% {
    text-shadow: 0 0 20px rgba(255, 105, 180, 0.8), 0 0 40px rgba(255, 105, 180, 0.4);
  }
  50% {
    text-shadow: 0 0 30px rgba(255, 105, 180, 1), 0 0 60px rgba(255, 105, 180, 0.6);
  }
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
  background: rgba(0, 255, 255, 0.15);
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.4);
}

.btn-primary:hover {
  background: rgba(0, 255, 255, 0.25);
  box-shadow: 0 0 16px rgba(0, 255, 255, 0.3);
  border-color: #00ffff;
}

.btn-reset {
  background: rgba(255, 105, 180, 0.1);
  color: #ff69b4;
  border: 1px solid rgba(255, 105, 180, 0.3);
}

.btn-reset:hover {
  background: rgba(255, 105, 180, 0.2);
  box-shadow: 0 0 16px rgba(255, 105, 180, 0.25);
  border-color: #ff69b4;
}

/* Footer */
.game-footer {
  margin-top: 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.hint-x {
  color: cyan;
}

.hint-o {
  color: #ff69b4;
}
</style>
