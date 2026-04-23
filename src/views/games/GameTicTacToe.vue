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
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
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
  if (winner.value === 'draw') return "It's a Draw!"
  if (winner.value === 'X') return 'Player X Wins!'
  if (winner.value === 'O') return 'Player O Wins!'
  return `Current Turn: ${currentPlayer.value}`
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
    <header class="page-header">
      <router-link to="/games" class="back">&larr; Back to Games</router-link>
      <h1>Tic-Tac-Toe</h1>
    </header>

    <div class="scoreboard">
      <div class="score-item score-x">
        <span class="score-label">Player X</span>
        <span class="score-value">{{ scoreX }}</span>
      </div>
      <div class="score-divider">vs</div>
      <div class="score-item score-o">
        <span class="score-label">Player O</span>
        <span class="score-value">{{ scoreO }}</span>
      </div>
    </div>

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

    <div class="actions">
      <button class="btn" @click="newGame">New Game</button>
      <button class="btn btn-reset" @click="resetScores">Reset Scores</button>
    </div>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100vh;
  padding: 32px 40px;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
  width: 100%;
  max-width: 400px;
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
  font-size: 28px;
  letter-spacing: 4px;
  color: #00ffff;
  text-shadow: 0 0 20px #00ffff;
  flex: 1;
}

.scoreboard {
  display: flex;
  align-items: center;
  gap: 32px;
  margin-bottom: 24px;
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
  font-size: 32px;
  font-weight: bold;
}

.score-x .score-value {
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.score-o .score-value {
  color: #ff44ff;
  text-shadow: 0 0 10px rgba(255, 68, 255, 0.5);
}

.score-divider {
  font-size: 16px;
  opacity: 0.3;
  text-transform: uppercase;
  letter-spacing: 2px;
  align-self: flex-end;
  margin-bottom: 8px;
}

.status {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 28px;
  letter-spacing: 2px;
  min-height: 30px;
  transition: all 0.3s;
}

.status.turn-x {
  color: #00ffff;
  text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
}

.status.turn-o {
  color: #ff44ff;
  text-shadow: 0 0 12px rgba(255, 68, 255, 0.6);
}

.status.x-win {
  color: #00ffff;
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.status.o-win {
  color: #ff44ff;
  text-shadow: 0 0 20px rgba(255, 68, 255, 0.8), 0 0 40px rgba(255, 68, 255, 0.4);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.status.draw {
  color: #aaaaaa;
  text-shadow: 0 0 10px rgba(170, 170, 170, 0.4);
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.board {
  display: grid;
  grid-template-columns: repeat(3, 100px);
  grid-template-rows: repeat(3, 100px);
  border: 2px solid #333;
  background: #333;
}

.cell {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border: 1px solid #333;
  cursor: default;
  transition: background 0.2s;
  user-select: none;
}

.cell.clickable {
  cursor: pointer;
}

.cell.clickable:hover {
  background: #0a0a0a;
}

.mark {
  font-size: 48px;
  font-weight: bold;
  line-height: 1;
}

.cell-x .mark {
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.cell-o .mark {
  color: #ff44ff;
  text-shadow: 0 0 10px rgba(255, 68, 255, 0.5);
}

.cell.win-cell {
  background: #0a0a0a;
}

.cell.win-cell-x {
  box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.15);
}

.cell.win-cell-x .mark {
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.4);
  animation: glow-x 1.5s ease-in-out infinite;
}

.cell.win-cell-o {
  box-shadow: inset 0 0 20px rgba(255, 68, 255, 0.15);
}

.cell.win-cell-o .mark {
  text-shadow: 0 0 20px rgba(255, 68, 255, 0.8), 0 0 40px rgba(255, 68, 255, 0.4);
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
    text-shadow: 0 0 20px rgba(255, 68, 255, 0.8), 0 0 40px rgba(255, 68, 255, 0.4);
  }
  50% {
    text-shadow: 0 0 30px rgba(255, 68, 255, 1), 0 0 60px rgba(255, 68, 255, 0.6);
  }
}

.actions {
  margin-top: 32px;
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 28px;
  font-size: 14px;
  background: rgba(0, 255, 255, 0.15);
  color: #00ffff;
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.3);
  border-color: #00ffff;
}

.btn-reset {
  background: rgba(255, 68, 255, 0.1);
  color: #ff44ff;
  border-color: rgba(255, 68, 255, 0.3);
}

.btn-reset:hover {
  background: rgba(255, 68, 255, 0.2);
  border-color: #ff44ff;
}
</style>
