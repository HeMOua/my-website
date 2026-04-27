<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type Stone = '' | 'B' | 'W'
type Seat = 'B' | 'W'
type Winner = Seat | 'draw' | null
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface RoomStatePayload {
  roomId: string
  board: Stone[][]
  turn: Seat
  winner: Winner
  status: 'waiting' | 'playing' | 'finished'
  players: {
    B: boolean
    W: boolean
  }
  rematchVotes: Seat[]
  boardSize: number
}

interface Envelope {
  type: string
  [key: string]: unknown
}

const BOARD_SIZE = 15
const HEARTBEAT_MS = 15000
const CONNECTION_TIMEOUT_MS = 5000
const RECONNECT_STORAGE_KEY = 'gomoku-online-reconnect'
const ROOM_STORAGE_KEY = 'gomoku-online-room-id'

const board = ref<Stone[][]>(createBoard())
const roomId = ref('')
const roomIdInput = ref('')
const reconnectToken = ref('')
const playerSeat = ref<Seat | null>(null)
const turn = ref<Seat>('B')
const winner = ref<Winner>(null)
const gameStatus = ref<'waiting' | 'playing' | 'finished'>('waiting')
const playersOnline = ref<{ B: boolean; W: boolean }>({ B: false, W: false })
const rematchVotes = ref<Seat[]>([])
const connectionStatus = ref<ConnectionStatus>('disconnected')
const systemMessage = ref('')

const ws = ref<WebSocket | null>(null)
let heartbeatTimer: ReturnType<typeof window.setInterval> | null = null
let connectionAttemptId = 0

const wsUrl = computed(() => {
  const configured = import.meta.env.VITE_GOMOKU_WS_URL
  const normalized = configured?.trim()
  if (normalized) {
    return normalized
  }
  return 'ws://localhost:8787'
})

const canPlaceStone = computed(() => {
  return (
    connectionStatus.value === 'connected' &&
    gameStatus.value === 'playing' &&
    winner.value === null &&
    playerSeat.value !== null &&
    playerSeat.value === turn.value
  )
})

const playerSeatLabel = computed(() => {
  if (playerSeat.value === 'B') return '黑方（先手）'
  if (playerSeat.value === 'W') return '白方（后手）'
  return '未分配'
})

const turnLabel = computed(() => {
  return turn.value === 'B' ? '黑方' : '白方'
})

const winnerLabel = computed(() => {
  if (winner.value === 'B') return '黑方获胜'
  if (winner.value === 'W') return '白方获胜'
  if (winner.value === 'draw') return '平局'
  return ''
})

const gameStatusText = computed(() => {
  if (gameStatus.value === 'waiting') return '等待双方就绪'
  if (gameStatus.value === 'playing') return `对局进行中，当前：${turnLabel.value}`
  return winnerLabel.value || '对局结束'
})

const connectionStatusText = computed(() => {
  if (connectionStatus.value === 'connected') return '已连接'
  if (connectionStatus.value === 'connecting') return '连接中'
  return '已断开'
})

onMounted(() => {
  const cachedRoomId = localStorage.getItem(ROOM_STORAGE_KEY)
  const cachedToken = localStorage.getItem(RECONNECT_STORAGE_KEY)

  if (cachedRoomId) {
    roomId.value = cachedRoomId
    roomIdInput.value = cachedRoomId
  }

  if (cachedToken) {
    reconnectToken.value = cachedToken
  }
})

onUnmounted(() => {
  stopHeartbeat()
  closeSocket()
})

async function createRoom() {
  const ok = await ensureConnected()
  if (!ok) return

  sendMessage({ type: 'create_room' })
  systemMessage.value = '正在创建房间...'
}

async function joinRoom() {
  const normalizedRoomId = roomIdInput.value.trim().toUpperCase()
  if (!normalizedRoomId) {
    systemMessage.value = '请输入房间号'
    return
  }

  const ok = await ensureConnected()
  if (!ok) return

  sendMessage({
    type: 'join_room',
    roomId: normalizedRoomId,
    reconnectToken: reconnectToken.value || undefined,
  })

  systemMessage.value = '正在加入房间...'
}

async function reconnectRoom() {
  const normalizedRoomId = roomIdInput.value.trim().toUpperCase() || roomId.value
  if (!normalizedRoomId || !reconnectToken.value) {
    systemMessage.value = '缺少房间号或重连凭证，无法重连'
    return
  }

  const ok = await ensureConnected()
  if (!ok) return

  sendMessage({
    type: 'join_room',
    roomId: normalizedRoomId,
    reconnectToken: reconnectToken.value,
  })

  systemMessage.value = '正在尝试重连房间...'
}

function handlePlaceStone(x: number, y: number) {
  if (connectionStatus.value !== 'connected') {
    systemMessage.value = '尚未连接联机服务'
    return
  }

  if (gameStatus.value !== 'playing') {
    systemMessage.value = '当前对局未开始或已结束'
    return
  }

  if (!playersOnline.value.B || !playersOnline.value.W) {
    systemMessage.value = '有玩家离线，暂时无法落子'
    return
  }

  if (playerSeat.value === null || playerSeat.value !== turn.value) {
    systemMessage.value = '当前不是你的回合'
    return
  }

  if (board.value[y]?.[x] !== '') {
    systemMessage.value = '该位置已落子'
    return
  }

  sendMessage({
    type: 'place_stone',
    x,
    y,
  })
}

function requestRematch() {
  if (gameStatus.value !== 'finished') {
    systemMessage.value = '对局未结束，不能重开'
    return
  }

  sendMessage({ type: 'request_rematch' })
}

async function copyRoomId() {
  if (!roomId.value) {
    systemMessage.value = '当前没有房间号可复制'
    return
  }

  try {
    await navigator.clipboard.writeText(roomId.value)
    systemMessage.value = `房间号 ${roomId.value} 已复制`
  } catch {
    systemMessage.value = '复制失败，请手动复制房间号'
  }
}

function seatName(seat: Seat) {
  return seat === 'B' ? '黑方' : '白方'
}

function cellClass(stone: Stone) {
  if (stone === 'B') return 'stone stone-black'
  if (stone === 'W') return 'stone stone-white'
  return 'stone stone-empty'
}

async function ensureConnected() {
  if (connectionStatus.value === 'connected' && ws.value?.readyState === WebSocket.OPEN) {
    return true
  }

  if (connectionStatus.value === 'connecting') {
    return false
  }

  connectionStatus.value = 'connecting'
  closeSocket()
  const attemptId = ++connectionAttemptId

  const nextSocket = new WebSocket(wsUrl.value)
  ws.value = nextSocket

  return new Promise<boolean>(resolve => {
    const connectionTimeout = window.setTimeout(() => {
      if (attemptId === connectionAttemptId && connectionStatus.value !== 'connected') {
        connectionStatus.value = 'disconnected'
        closeSocket()
        resolve(false)
      }
    }, CONNECTION_TIMEOUT_MS)

    nextSocket.onopen = () => {
      if (attemptId !== connectionAttemptId) {
        nextSocket.close()
        return
      }
      window.clearTimeout(connectionTimeout)
      connectionStatus.value = 'connected'
      systemMessage.value = '已连接联机服务'
      startHeartbeat()
      resolve(true)
    }

    nextSocket.onmessage = event => {
      handleServerMessage(event.data)
    }

    nextSocket.onerror = () => {
      if (attemptId !== connectionAttemptId) {
        return
      }
      window.clearTimeout(connectionTimeout)
      systemMessage.value = '连接联机服务失败'
    }

    nextSocket.onclose = () => {
      if (attemptId !== connectionAttemptId) {
        return
      }
      window.clearTimeout(connectionTimeout)
      connectionStatus.value = 'disconnected'
      stopHeartbeat()
      systemMessage.value = '连接已断开，可使用重连按钮恢复对局'
      ws.value = null
    }
  })
}

function closeSocket() {
  if (!ws.value) return
  if (ws.value.readyState === WebSocket.OPEN || ws.value.readyState === WebSocket.CONNECTING) {
    ws.value.close()
  }
  ws.value = null
}

function sendMessage(payload: Record<string, unknown>) {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
    systemMessage.value = '尚未连接联机服务'
    return
  }
  ws.value.send(JSON.stringify(payload))
}

function handleServerMessage(raw: unknown) {
  if (typeof raw !== 'string') return

  let message: Envelope
  try {
    message = JSON.parse(raw) as Envelope
  } catch {
    systemMessage.value = '收到无效服务端消息'
    return
  }

  if (message.type === 'welcome') {
    return
  }

  if (message.type === 'room_created' || message.type === 'room_joined') {
    if (typeof message.roomId === 'string') {
      roomId.value = message.roomId
      roomIdInput.value = message.roomId
      localStorage.setItem(ROOM_STORAGE_KEY, message.roomId)
    }

    if (message.seat === 'B' || message.seat === 'W') {
      playerSeat.value = message.seat
    }

    if (typeof message.reconnectToken === 'string') {
      reconnectToken.value = message.reconnectToken
      localStorage.setItem(RECONNECT_STORAGE_KEY, message.reconnectToken)
    }

    systemMessage.value = `已进入房间 ${roomId.value}`
    sendMessage({ type: 'sync_state' })
    return
  }

  if (message.type === 'state_sync') {
    const state = message.state as RoomStatePayload | undefined
    if (!state) return

    if (state.boardSize === BOARD_SIZE) {
      board.value = cloneBoard(state.board)
    }
    roomId.value = state.roomId
    turn.value = state.turn
    winner.value = state.winner
    gameStatus.value = state.status
    playersOnline.value = { ...state.players }
    rematchVotes.value = [...state.rematchVotes]
    return
  }

  if (message.type === 'opponent_disconnected') {
    systemMessage.value = '对手已离线，等待重连中'
    return
  }

  if (message.type === 'opponent_reconnected') {
    systemMessage.value = '对手已重新连接'
    return
  }

  if (message.type === 'rematch_status') {
    const votes = Array.isArray(message.votes)
      ? message.votes.filter((vote): vote is Seat => vote === 'B' || vote === 'W')
      : []
    rematchVotes.value = votes
    systemMessage.value = `重开投票：${votes.map(seatName).join('、') || '暂无'}`
    return
  }

  if (message.type === 'game_reset') {
    systemMessage.value = '双方已确认重开，对局重置'
    return
  }

  if (message.type === 'game_over') {
    if (message.winner === 'B' || message.winner === 'W' || message.winner === 'draw') {
      winner.value = message.winner
    }
    systemMessage.value = winnerLabel.value || '对局结束'
    return
  }

  if (message.type === 'error') {
    if (typeof message.message === 'string') {
      systemMessage.value = message.message
    }
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = window.setInterval(() => {
    sendMessage({ type: 'heartbeat' })
  }, HEARTBEAT_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array<Stone>(BOARD_SIZE).fill(''))
}

function cloneBoard(source: Stone[][]) {
  return source.map(row => [...row])
}
</script>

<template>
  <div class="gomoku-page">
    <header class="gomoku-header">
      <router-link to="/games" class="back-link">&larr; 游戏大厅</router-link>
      <h1 class="title">联机五子棋</h1>
      <p class="subtitle">两人房间实时对战 · 同时支持移动端与 Web 端</p>
    </header>

    <section class="panel connection-panel">
      <div class="field-group">
        <label for="room-id">房间号</label>
        <input id="room-id" v-model="roomIdInput" maxlength="12" placeholder="例如：AB12CD" aria-label="房间号" />
      </div>

      <div class="actions">
        <button class="btn primary" @click="createRoom">创建房间</button>
        <button class="btn" @click="joinRoom">加入房间</button>
        <button class="btn" @click="reconnectRoom">断线重连</button>
        <button class="btn" @click="copyRoomId">复制房间号</button>
      </div>

      <div class="status-grid">
        <div class="status-item">
          <span>连接状态</span>
          <strong>{{ connectionStatusText }}</strong>
        </div>
        <div class="status-item">
          <span>当前房间</span>
          <strong>{{ roomId || '-' }}</strong>
        </div>
        <div class="status-item">
          <span>我的身份</span>
          <strong>{{ playerSeatLabel }}</strong>
        </div>
      </div>

      <p class="tip" :class="{ warning: gameStatus === 'waiting' || connectionStatus !== 'connected' }">
        {{ systemMessage || gameStatusText }}
      </p>
    </section>

    <section class="panel game-panel">
      <div class="top-info">
        <div class="badge">状态：{{ gameStatusText }}</div>
        <div class="badge">在线：黑方 {{ playersOnline.B ? '在线' : '离线' }} / 白方 {{ playersOnline.W ? '在线' : '离线' }}</div>
        <div class="badge" v-if="gameStatus === 'finished'">
          重开投票：{{ rematchVotes.length > 0 ? rematchVotes.map(seatName).join('、') : '暂无' }}
        </div>
      </div>

      <div class="board-wrap">
        <div class="board" role="grid">
          <div
            v-for="(row, y) in board"
            :key="`row-${y}`"
            class="row"
          >
            <button
              v-for="(stone, x) in row"
              :key="`cell-${x}-${y}`"
              class="cell"
              :class="{ clickable: canPlaceStone && stone === '' }"
              role="gridcell"
              tabindex="0"
              @click="handlePlaceStone(x, y)"
            >
              <span :class="cellClass(stone)"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="footer-actions">
        <button class="btn primary" :disabled="gameStatus !== 'finished'" @click="requestRematch">
          请求重开
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.gomoku-page {
  --gomoku-btn-bg: rgba(83, 243, 255, 0.08);
  --gomoku-btn-primary-bg: rgba(83, 243, 255, 0.2);
  --gomoku-btn-primary-text: #04121f;
  width: min(1100px, calc(100vw - 24px));
  margin: 18px auto 36px;
  display: grid;
  gap: 14px;
}

.gomoku-header {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  background: rgba(8, 16, 32, 0.78);
}

.back-link {
  color: var(--cyan);
  font-size: 0.86rem;
}

.title {
  margin-top: 10px;
  font-size: clamp(1.7rem, 3.8vw, 2.6rem);
  letter-spacing: 0.08em;
}

.subtitle {
  margin-top: 8px;
  color: var(--muted);
  line-height: 1.6;
}

.panel {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  background: rgba(8, 16, 32, 0.78);
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label {
  font-size: 0.82rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--cyan);
}

.field-group input {
  width: min(360px, 100%);
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(91, 228, 255, 0.2);
  background: rgba(7, 14, 28, 0.9);
  color: var(--text);
}

.actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  border: 1px solid rgba(91, 228, 255, 0.22);
  background: var(--gomoku-btn-bg);
  color: var(--text);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--gomoku-btn-primary-bg);
  color: var(--gomoku-btn-primary-text);
  font-weight: 700;
}

.status-grid {
  margin-top: 12px;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.status-item {
  border: 1px solid rgba(91, 228, 255, 0.16);
  border-radius: 12px;
  padding: 8px 10px;
  display: grid;
  gap: 4px;
}

.status-item span {
  color: var(--muted);
  font-size: 0.78rem;
}

.tip {
  margin-top: 10px;
  color: #9ef6ff;
  min-height: 1.4em;
}

.tip.warning {
  color: #ffd78f;
}

.top-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.badge {
  border: 1px solid rgba(91, 228, 255, 0.16);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.8rem;
}

.board-wrap {
  width: min(820px, 100%);
  margin-inline: auto;
}

.board {
  width: 100%;
  aspect-ratio: 1;
  background: #7f5f39;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.38);
  padding: 8px;
  display: grid;
  grid-template-rows: repeat(15, minmax(0, 1fr));
  gap: 1px;
}

.row {
  display: grid;
  grid-template-columns: repeat(15, minmax(0, 1fr));
  gap: 1px;
}

.cell {
  border: none;
  padding: 0;
  background: rgba(255, 240, 210, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.16);
  min-width: 0;
}

.cell.clickable {
  cursor: pointer;
}

.stone {
  width: 76%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.stone-empty {
  opacity: 0;
}

.stone-black {
  background: radial-gradient(circle at 30% 30%, #555, #0f0f0f 70%);
}

.stone-white {
  background: radial-gradient(circle at 30% 30%, #fff, #d7d7d7 70%);
  border: 1px solid rgba(0, 0, 0, 0.22);
}

.footer-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .gomoku-page {
    width: calc(100vw - 12px);
    margin-top: 10px;
  }

  .panel,
  .gomoku-header {
    padding: 12px;
    border-radius: 14px;
  }

  .btn {
    flex: 1;
    min-width: 132px;
  }

  .field-group input {
    width: 100%;
  }
}
</style>
