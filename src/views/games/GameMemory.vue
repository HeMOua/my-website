<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Card {
  id: number
  symbol: string
  flipped: boolean
  matched: boolean
}

const symbols = ['🎮', '🎲', '🎯', '🏆', '🎪', '🎨', '🎭', '🎵']
const cards = ref<Card[]>([])
const flippedCards = ref<number[]>([])
const moves = ref(0)
const matchedPairs = ref(0)
const gameWon = ref(false)
const timer = ref(0)
const gameStarted = ref(false)
let timerInterval: ReturnType<typeof setInterval> | null = null

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function initGame() {
  const deck = shuffle([...symbols, ...symbols])
  cards.value = deck.map((symbol, i) => ({
    id: i,
    symbol,
    flipped: false,
    matched: false,
  }))
  flippedCards.value = []
  moves.value = 0
  matchedPairs.value = 0
  gameWon.value = false
  timer.value = 0
  gameStarted.value = false
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function startTimer() {
  if (!gameStarted.value) {
    gameStarted.value = true
    timerInterval = setInterval(() => {
      timer.value++
    }, 1000)
  }
}

function flipCard(index: number) {
  if (gameWon.value) return
  if (cards.value[index].flipped || cards.value[index].matched) return
  if (flippedCards.value.length >= 2) return

  startTimer()
  cards.value[index].flipped = true
  flippedCards.value.push(index)

  if (flippedCards.value.length === 2) {
    moves.value++
    const [i1, i2] = flippedCards.value
    if (cards.value[i1].symbol === cards.value[i2].symbol) {
      cards.value[i1].matched = true
      cards.value[i2].matched = true
      matchedPairs.value++
      flippedCards.value = []
      if (matchedPairs.value === symbols.length) {
        gameWon.value = true
        if (timerInterval) {
          clearInterval(timerInterval)
          timerInterval = null
        }
      }
    } else {
      setTimeout(() => {
        cards.value[i1].flipped = false
        cards.value[i2].flipped = false
        flippedCards.value = []
      }, 1000)
    }
  }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

onMounted(initGame)
onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})
</script>

<template>
  <div class="game-page">
    <header class="page-header">
      <router-link to="/games" class="back">&larr; Back to Games</router-link>
      <h1>Memory Match</h1>
    </header>

    <div class="stats">
      <div class="stat-item">
        <span class="stat-label">Time</span>
        <span class="stat-value">{{ formatTime(timer) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Moves</span>
        <span class="stat-value">{{ moves }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pairs</span>
        <span class="stat-value">{{ matchedPairs }} / {{ symbols.length }}</span>
      </div>
    </div>

    <div class="card-grid">
      <div
        v-for="(card, index) in cards"
        :key="card.id"
        class="card"
        :class="{ flipped: card.flipped || card.matched, matched: card.matched }"
        @click="flipCard(index)"
      >
        <div class="card-inner">
          <div class="card-front">?</div>
          <div class="card-back">{{ card.symbol }}</div>
        </div>
      </div>
    </div>

    <div v-if="gameWon" class="overlay">
      <div class="win-modal">
        <h2>You Win!</h2>
        <p>Time: {{ formatTime(timer) }}</p>
        <p>Moves: {{ moves }}</p>
        <button class="btn" @click="initGame">Play Again</button>
      </div>
    </div>

    <div class="actions">
      <button class="btn" @click="initGame">New Game</button>
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
  margin-bottom: 24px;
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
}

.stats {
  display: flex;
  gap: 40px;
  margin-bottom: 28px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(0, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(4, 80px);
  gap: 12px;
  margin-bottom: 28px;
}

.card {
  width: 80px;
  height: 100px;
  perspective: 600px;
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.5s;
  transform-style: preserve-3d;
}

.card.flipped .card-inner {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  backface-visibility: hidden;
  font-size: 28px;
}

.card-front {
  background: #1a1a2e;
  border: 2px solid rgba(0, 255, 255, 0.3);
  color: rgba(0, 255, 255, 0.5);
  font-size: 32px;
  font-weight: bold;
  transition: border-color 0.3s;
}

.card-front:hover {
  border-color: #00ffff;
}

.card-back {
  background: #1a1a2e;
  border: 2px solid rgba(0, 255, 255, 0.5);
  transform: rotateY(180deg);
}

.card.matched .card-back {
  background: rgba(0, 255, 255, 0.15);
  border-color: #00ffff;
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.win-modal {
  background: #1a1a2e;
  border: 2px solid #00ffff;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 0 40px rgba(0, 255, 255, 0.3);
}

.win-modal h2 {
  font-size: 32px;
  color: #00ffff;
  text-shadow: 0 0 20px #00ffff;
  margin-bottom: 16px;
}

.win-modal p {
  font-size: 18px;
  margin-bottom: 8px;
  opacity: 0.8;
  color: #fff;
}

.btn {
  margin-top: 16px;
  padding: 10px 28px;
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 8px;
  color: #00ffff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:hover {
  background: rgba(0, 255, 255, 0.3);
  border-color: #00ffff;
}

.actions {
  margin-top: 8px;
}
</style>
