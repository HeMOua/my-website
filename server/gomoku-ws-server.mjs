import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'

const BOARD_SIZE = 15
const PORT = Number(process.env.GOMOKU_WS_PORT || 8787)
const ROOM_ID_LENGTH = 6
const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_ID_MAX_RETRIES = 1000
const RECONNECT_GRACE_MS = 5 * 60 * 1000
const CLEANUP_INTERVAL_MS = 30 * 1000

/** @typedef {'B' | 'W'} Seat */

/** @type {Map<string, RoomState>} */
const rooms = new Map()
/** @type {Map<WebSocket, ClientContext>} */
const clients = new Map()

const httpServer = createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ service: 'gomoku-ws', status: 'ok' }))
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', socket => {
  const clientId = randomUUID()
  clients.set(socket, { clientId, roomId: null, seat: null })

  send(socket, { type: 'welcome', clientId })

  socket.on('message', raw => {
    handleMessage(socket, raw)
  })

  socket.on('close', () => {
    handleDisconnect(socket)
    clients.delete(socket)
  })
})

setInterval(() => {
  const now = Date.now()
  for (const [roomId, room] of rooms) {
    const bothOffline = !room.players.B.connected && !room.players.W.connected
    if (bothOffline && now - room.lastActivity > RECONNECT_GRACE_MS) {
      console.log(`[gomoku-ws] cleanup room ${roomId}`)
      rooms.delete(roomId)
    }
  }
}, CLEANUP_INTERVAL_MS)

httpServer.listen(PORT, () => {
  console.log(`Gomoku websocket server listening on ws://localhost:${PORT}`)
})

/**
 * @param {WebSocket} socket
 * @param {import('ws').RawData} raw
 */
function handleMessage(socket, raw) {
  const message = parseJson(raw)
  if (!message) {
    send(socket, { type: 'error', message: '消息格式错误：非 JSON 数据' })
    return
  }

  if (typeof message.type !== 'string') {
    send(socket, { type: 'error', message: '消息格式错误：缺少 type' })
    return
  }

  switch (message.type) {
    case 'create_room':
      createRoom(socket)
      return
    case 'join_room':
      joinRoom(socket, message)
      return
    case 'place_stone':
      placeStone(socket, message)
      return
    case 'request_rematch':
      requestRematch(socket)
      return
    case 'sync_state':
      syncState(socket)
      return
    case 'heartbeat':
      send(socket, { type: 'heartbeat_ack', timestamp: Date.now() })
      return
    default:
      send(socket, { type: 'error', message: `未知消息类型: ${message.type}` })
  }
}

/**
 * @param {WebSocket} socket
 */
function createRoom(socket) {
  const oldContext = clients.get(socket)
  if (!oldContext) return

  leaveRoom(socket)

  let roomId = ''
  try {
    roomId = generateRoomId()
  } catch {
    send(socket, { type: 'error', message: '房间创建失败，请稍后重试' })
    return
  }
  const reconnectToken = randomUUID()
  /** @type {RoomState} */
  const room = {
    roomId,
    board: createBoard(),
    turn: 'B',
    winner: null,
    status: 'waiting',
    rematchVotes: new Set(),
    lastActivity: Date.now(),
    players: {
      B: {
        socket,
        connected: true,
        reconnectToken,
        clientId: oldContext.clientId,
      },
      W: {
        socket: null,
        connected: false,
        reconnectToken: null,
        clientId: null,
      },
    },
  }

  rooms.set(roomId, room)
  clients.set(socket, {
    clientId: oldContext.clientId,
    roomId,
    seat: 'B',
  })

  send(socket, { type: 'room_created', roomId, seat: 'B', reconnectToken })
  broadcastState(room)
}

/**
 * @param {WebSocket} socket
 * @param {Record<string, unknown>} message
 */
function joinRoom(socket, message) {
  const roomId = typeof message.roomId === 'string' ? message.roomId.trim().toUpperCase() : ''
  if (!roomId) {
    send(socket, { type: 'error', message: '请提供房间号' })
    return
  }

  const room = rooms.get(roomId)
  if (!room) {
    send(socket, { type: 'error', message: '房间不存在或已过期' })
    return
  }

  const reconnectToken = typeof message.reconnectToken === 'string' ? message.reconnectToken : null
  const oldContext = clients.get(socket)
  if (!oldContext) return

  leaveRoom(socket)

  /** @type {Seat | null} */
  let seat = null

  if (reconnectToken) {
    if (room.players.B.reconnectToken === reconnectToken) seat = 'B'
    if (room.players.W.reconnectToken === reconnectToken) seat = 'W'
  }

  if (!seat) {
    if (!room.players.W.reconnectToken) {
      seat = 'W'
      room.players.W.reconnectToken = randomUUID()
    } else if (!room.players.B.reconnectToken) {
      seat = 'B'
      room.players.B.reconnectToken = randomUUID()
    }
  }

  if (!seat) {
    send(socket, { type: 'error', message: '房间已满，无法加入' })
    return
  }

  const player = room.players[seat]
  player.socket = socket
  player.connected = true
  player.clientId = oldContext.clientId

  clients.set(socket, {
    clientId: oldContext.clientId,
    roomId,
    seat,
  })

  room.lastActivity = Date.now()
  updateRoomStatus(room)

  send(socket, {
    type: 'room_joined',
    roomId,
    seat,
    reconnectToken: player.reconnectToken,
  })

  const other = seat === 'B' ? room.players.W : room.players.B
  if (other.connected && other.socket) {
    send(other.socket, { type: 'opponent_reconnected', seat })
  }

  broadcastState(room)
}

/**
 * @param {WebSocket} socket
 * @param {Record<string, unknown>} message
 */
function placeStone(socket, message) {
  const context = clients.get(socket)
  if (!context?.roomId || !context.seat) {
    send(socket, { type: 'error', message: '你尚未加入房间' })
    return
  }

  const room = rooms.get(context.roomId)
  if (!room) {
    send(socket, { type: 'error', message: '房间不存在或已过期' })
    return
  }

  const x = toSafeInt(message.x)
  const y = toSafeInt(message.y)

  if (x === null || y === null) {
    send(socket, { type: 'error', message: '落子坐标无效' })
    return
  }

  if (room.status !== 'playing') {
    send(socket, { type: 'error', message: '对局尚未开始或已结束' })
    return
  }

  if (!room.players.B.connected || !room.players.W.connected) {
    send(socket, { type: 'error', message: '对手未在线，暂时无法落子' })
    return
  }

  if (context.seat !== room.turn) {
    send(socket, { type: 'error', message: '当前不是你的回合' })
    return
  }

  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) {
    send(socket, { type: 'error', message: '落子越界' })
    return
  }

  if (room.board[y][x] !== '') {
    send(socket, { type: 'error', message: '该位置已被占用' })
    return
  }

  room.board[y][x] = context.seat
  room.lastActivity = Date.now()

  const winner = detectWinner(room.board, x, y, context.seat)
  if (winner) {
    room.winner = winner
    room.status = 'finished'
  } else if (isBoardFull(room.board)) {
    room.winner = 'draw'
    room.status = 'finished'
  } else {
    room.turn = context.seat === 'B' ? 'W' : 'B'
  }

  broadcastState(room)

  if (room.status === 'finished') {
    broadcast(room, {
      type: 'game_over',
      winner: room.winner,
    })
  }
}

/**
 * @param {WebSocket} socket
 */
function requestRematch(socket) {
  const context = clients.get(socket)
  if (!context?.roomId || !context.seat) {
    send(socket, { type: 'error', message: '你尚未加入房间' })
    return
  }

  const room = rooms.get(context.roomId)
  if (!room) {
    send(socket, { type: 'error', message: '房间不存在或已过期' })
    return
  }

  if (room.status !== 'finished') {
    send(socket, { type: 'error', message: '对局尚未结束，不能请求重开' })
    return
  }

  room.rematchVotes.add(context.seat)
  room.lastActivity = Date.now()

  broadcast(room, {
    type: 'rematch_status',
    votes: [...room.rematchVotes],
  })

  if (room.rematchVotes.size === 2) {
    room.board = createBoard()
    room.turn = 'B'
    room.winner = null
    updateRoomStatus(room)
    room.rematchVotes.clear()

    broadcast(room, { type: 'game_reset' })
    broadcastState(room)
  }
}

/**
 * @param {WebSocket} socket
 */
function syncState(socket) {
  const context = clients.get(socket)
  if (!context?.roomId) {
    send(socket, { type: 'error', message: '你尚未加入房间' })
    return
  }

  const room = rooms.get(context.roomId)
  if (!room) {
    send(socket, { type: 'error', message: '房间不存在或已过期' })
    return
  }

  send(socket, {
    type: 'state_sync',
    state: serializeRoom(room),
  })
}

/**
 * @param {WebSocket} socket
 */
function handleDisconnect(socket) {
  const context = clients.get(socket)
  if (!context?.roomId || !context.seat) return

  const room = rooms.get(context.roomId)
  if (!room) return

  const player = room.players[context.seat]
  if (player.socket === socket) {
    player.socket = null
    player.connected = false
  }

  room.lastActivity = Date.now()

  if (room.status === 'playing') {
    room.status = 'waiting'
  }

  const otherSeat = context.seat === 'B' ? 'W' : 'B'
  const otherPlayer = room.players[otherSeat]

  if (otherPlayer.connected && otherPlayer.socket) {
    send(otherPlayer.socket, { type: 'opponent_disconnected', seat: context.seat })
    send(otherPlayer.socket, {
      type: 'state_sync',
      state: serializeRoom(room),
    })
  }

  clients.set(socket, {
    clientId: context.clientId,
    roomId: null,
    seat: null,
  })
}

/**
 * @param {WebSocket} socket
 */
function leaveRoom(socket) {
  const context = clients.get(socket)
  if (!context?.roomId || !context.seat) return

  const room = rooms.get(context.roomId)
  if (!room) {
    clients.set(socket, {
      clientId: context.clientId,
      roomId: null,
      seat: null,
    })
    return
  }

  const player = room.players[context.seat]
  if (player.socket === socket) {
    player.socket = null
    player.connected = false
  }

  updateRoomStatus(room)
  room.lastActivity = Date.now()

  const otherSeat = context.seat === 'B' ? 'W' : 'B'
  const other = room.players[otherSeat]
  if (other.connected && other.socket) {
    send(other.socket, { type: 'opponent_disconnected', seat: context.seat })
    send(other.socket, {
      type: 'state_sync',
      state: serializeRoom(room),
    })
  }

  clients.set(socket, {
    clientId: context.clientId,
    roomId: null,
    seat: null,
  })
}

/**
 * @param {RoomState} room
 */
function broadcastState(room) {
  broadcast(room, {
    type: 'state_sync',
    state: serializeRoom(room),
  })
}

/**
 * @param {RoomState} room
 * @param {Record<string, unknown>} payload
 */
function broadcast(room, payload) {
  if (room.players.B.connected && room.players.B.socket) {
    send(room.players.B.socket, payload)
  }
  if (room.players.W.connected && room.players.W.socket) {
    send(room.players.W.socket, payload)
  }
}

/**
 * @param {RoomState} room
 */
function serializeRoom(room) {
  return {
    roomId: room.roomId,
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    status: room.status,
    players: {
      B: room.players.B.connected,
      W: room.players.W.connected,
    },
    rematchVotes: [...room.rematchVotes],
    boardSize: BOARD_SIZE,
  }
}

/**
 * @param {WebSocket} socket
 * @param {Record<string, unknown>} payload
 */
function send(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(payload))
}

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(''))
}

/**
 * @param {string[][]} board
 */
function isBoardFull(board) {
  return board.every(row => row.every(cell => cell !== ''))
}

/**
 * @param {string[][]} board
 * @param {number} x
 * @param {number} y
 * @param {Seat} stone
 */
function detectWinner(board, x, y, stone) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]

  for (const [dx, dy] of directions) {
    let count = 1

    count += countDirection(board, x, y, dx, dy, stone)
    count += countDirection(board, x, y, -dx, -dy, stone)

    if (count >= 5) return stone
  }

  return null
}

/**
 * @param {string[][]} board
 * @param {number} x
 * @param {number} y
 * @param {number} dx
 * @param {number} dy
 * @param {Seat} stone
 */
function countDirection(board, x, y, dx, dy, stone) {
  let count = 0
  let nx = x + dx
  let ny = y + dy

  while (isInBounds(nx, ny) && board[ny][nx] === stone) {
    count += 1
    nx += dx
    ny += dy
  }

  return count
}

/**
 * @param {unknown} value
 */
function toSafeInt(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value
}

function generateRoomId() {
  let roomId = ''
  let retries = 0

  do {
    roomId = Array.from(
      { length: ROOM_ID_LENGTH },
      () => ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)],
    ).join('')
    retries += 1

    if (retries > ROOM_ID_MAX_RETRIES) {
      throw new Error('无法分配新的房间号，请稍后重试')
    }
  } while (rooms.has(roomId))

  return roomId
}

/**
 * @param {import('ws').RawData} raw
 */
function parseJson(raw) {
  try {
    const value = JSON.parse(String(raw))
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

/**
 * @param {unknown} value
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {number} x
 * @param {number} y
 */
function isInBounds(x, y) {
  return y >= 0 && y < BOARD_SIZE && x >= 0 && x < BOARD_SIZE
}

/**
 * @param {RoomState} room
 */
function updateRoomStatus(room) {
  const bothOnline = room.players.B.connected && room.players.W.connected
  if (bothOnline && !room.winner) {
    room.status = 'playing'
    return
  }

  room.status = room.winner ? 'finished' : 'waiting'
}

/**
 * @typedef {Object} ClientContext
 * @property {string} clientId
 * @property {string | null} roomId
 * @property {Seat | null} seat
 */

/**
 * @typedef {Object} PlayerSlot
 * @property {WebSocket | null} socket
 * @property {boolean} connected
 * @property {string | null} reconnectToken
 * @property {string | null} clientId
 */

/**
 * @typedef {Object} RoomState
 * @property {string} roomId
 * @property {string[][]} board
 * @property {Seat} turn
 * @property {Seat | 'draw' | null} winner
 * @property {'waiting' | 'playing' | 'finished'} status
 * @property {Set<Seat>} rematchVotes
 * @property {number} lastActivity
 * @property {{B: PlayerSlot, W: PlayerSlot}} players
 */
