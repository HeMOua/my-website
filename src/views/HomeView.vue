<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'

interface GraphNode {
  label: string
  route?: string
  mesh: THREE.Mesh
  glow: THREE.Mesh
  position: THREE.Vector3
  isRoute: boolean
}

const router = useRouter()
const canvasRef = ref<HTMLCanvasElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let graphGroup: THREE.Group
let starsGeometry: THREE.BufferGeometry
let stars: THREE.Points
let animationId: number
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let graphNodes: GraphNode[] = []
let hoveredNode = ref<GraphNode | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

const matrixColumns = Array.from({ length: 22 }, (_, i) => {
  const chars = '01アイウエオカキクケコサシスセソ0123456789'
  const stream = Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return {
    id: i,
    left: `${(i / 22) * 100}%`,
    duration: `${8 + Math.random() * 8}s`,
    delay: `${Math.random() * 10}s`,
    stream,
  }
})

// 拖拽控制
let isDragging = false
let previousMousePosition = { x: 0, y: 0 }
let targetRotation = { x: 0, y: 0 }
let currentRotation = { x: 0, y: 0 }
let touchMoved = false

// 飞行速度控制（加速度模型）
const FULL_SPEED = 2
const MIN_SPEED = 0.3
let currentSpeed = FULL_SPEED
let speedVelocity = 0 // 速度的变化率（加速度）
const SPEED_ACCELERATION = 0.002 // 加速度
const SPEED_DAMPING = 0.96 // 阻尼

// 图谱结构：中心节点 -> 主节点 -> 子节点
const graphConfig = {
  center: { label: '技数斋' },
  mainNodes: [
    { label: '博客', route: '/blog', children: ['前端', '后端', 'AI'] },
    { label: '项目', route: '/projects', children: ['开源', '工具库', 'Demo'] },
    { label: '游戏', route: '/games', children: ['策略益智', '动作反应', '经典街机'] },
    { label: '关于', route: '/about', children: ['简介', '技术栈', '经历'] },
    { label: '联系', route: '/contact', children: ['邮件', 'GitHub', '微信'] },
  ],
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', onResize)
  canvasRef.value?.addEventListener('click', onClick)
  canvasRef.value?.addEventListener('mousedown', onMouseDown)
  canvasRef.value?.addEventListener('mousemove', onMouseMove)
  canvasRef.value?.addEventListener('mouseup', onMouseUp)
  canvasRef.value?.addEventListener('mouseleave', onMouseUp)
  canvasRef.value?.addEventListener('touchstart', onTouchStart)
  canvasRef.value?.addEventListener('touchmove', onTouchMove, { passive: false })
  canvasRef.value?.addEventListener('touchend', onTouchEnd)
  canvasRef.value?.addEventListener('touchcancel', onTouchEnd)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
  canvasRef.value?.removeEventListener('click', onClick)
  canvasRef.value?.removeEventListener('mousedown', onMouseDown)
  canvasRef.value?.removeEventListener('mousemove', onMouseMove)
  canvasRef.value?.removeEventListener('mouseup', onMouseUp)
  canvasRef.value?.removeEventListener('mouseleave', onMouseUp)
  canvasRef.value?.removeEventListener('touchstart', onTouchStart)
  canvasRef.value?.removeEventListener('touchmove', onTouchMove)
  canvasRef.value?.removeEventListener('touchend', onTouchEnd)
  canvasRef.value?.removeEventListener('touchcancel', onTouchEnd)
  renderer?.dispose()
})

function createNode(label: string, position: THREE.Vector3, isRoute: boolean, route?: string): GraphNode {
  const size = isRoute ? 0.18 : 0.1
  const nodeGeometry = new THREE.SphereGeometry(size, 16, 16)
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: isRoute ? 0x00ffff : 0x4488aa })
  const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial)
  nodeMesh.position.copy(position)
  nodeMesh.userData = { label, route }
  graphGroup.add(nodeMesh)

  const glowSize = isRoute ? 0.3 : 0.18
  const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 16)
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: isRoute ? 0x00ffff : 0x4488aa,
    transparent: true,
    opacity: isRoute ? 0.15 : 0.08,
  })
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial)
  glowMesh.position.copy(position)
  graphGroup.add(glowMesh)

  const graphNode: GraphNode = { label, route, mesh: nodeMesh, glow: glowMesh, position, isRoute }
  graphNodes.push(graphNode)
  return graphNode
}

function createEdge(from: THREE.Vector3, to: THREE.Vector3, opacity = 0.25) {
  const points = [from, to]
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity })
  const line = new THREE.Line(geometry, material)
  graphGroup.add(line)
  return line
}

function initThree() {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.value! })
  renderer.setSize(window.innerWidth, window.innerHeight)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  // 星际穿越星空 - 星星分布在Z轴上，从远到近
  const starsCount = 3000
  starsGeometry = new THREE.BufferGeometry()
  const positions = new Float32Array(starsCount * 3)
  const velocities = new Float32Array(starsCount)

  for (let i = 0; i < starsCount; i++) {
    // 星星分布在圆柱形区域内
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 800 + 100
    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = Math.sin(angle) * radius
    positions[i * 3 + 2] = Math.random() * 2000 - 1000 // Z: -1000 到 1000
    velocities[i] = Math.random() * 2 + 1 // 速度
  }

  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  starsGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1))

  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  })
  stars = new THREE.Points(starsGeometry, starsMaterial)
  scene.add(stars)

  // 图谱组
  graphGroup = new THREE.Group()
  scene.add(graphGroup)

  // 中心节点
  const centerPos = new THREE.Vector3(0, 0, 0)
  createNode(graphConfig.center.label, centerPos, false)

  // 主节点分布在球面上
  const mainRadius = 2.5
  const mainCount = graphConfig.mainNodes.length
  const mainNodes: GraphNode[] = []

  graphConfig.mainNodes.forEach((config, i) => {
    // 斐波那契球面分布
    const phi = Math.acos(1 - (2 * (i + 0.5)) / mainCount)
    const theta = Math.PI * (1 + Math.sqrt(5)) * i

    const x = mainRadius * Math.sin(phi) * Math.cos(theta)
    const y = mainRadius * Math.sin(phi) * Math.sin(theta)
    const z = mainRadius * Math.cos(phi)

    const pos = new THREE.Vector3(x, y, z)
    const mainNode = createNode(config.label, pos, true, config.route)
    mainNodes.push(mainNode)

    // 中心 -> 主节点 连线
    createEdge(centerPos, pos, 0.35)

    // 子节点
    const childRadius = 1.2
    const childCount = config.children.length
    config.children.forEach((childLabel, j) => {
      // 子节点围绕父节点分布
      const childPhi = Math.acos(1 - (2 * (j + 0.5)) / childCount)
      const childTheta = (Math.PI * 2 * j) / childCount + theta

      const cx = pos.x + childRadius * Math.sin(childPhi) * Math.cos(childTheta)
      const cy = pos.y + childRadius * Math.sin(childPhi) * Math.sin(childTheta)
      const cz = pos.z + childRadius * Math.cos(childPhi)

      const childPos = new THREE.Vector3(cx, cy, cz)
      createNode(childLabel, childPos, false)

      // 父节点 -> 子节点 连线
      createEdge(pos, childPos, 0.15)
    })
  })

  // 主节点之间的横向连线（相邻）
  for (let i = 0; i < mainNodes.length; i++) {
    const next = mainNodes[(i + 1) % mainNodes.length]
    createEdge(mainNodes[i]!.position, next!.position, 0.1)
  }

  camera.position.z = 8
  animate()
}

function animate(time = 0) {
  animationId = requestAnimationFrame(animate)
  const t = time * 0.001

  // 平滑旋转
  currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08
  currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08

  graphGroup.rotation.x = currentRotation.x
  graphGroup.rotation.y = currentRotation.y

  // 呼吸缩放
  const scale = 1 + Math.sin(t * 1.5) * 0.05
  graphGroup.scale.set(scale, scale, scale)

  // 飞行速度 - 加速度模型
  const targetSpeed = isDragging ? MIN_SPEED : FULL_SPEED
  const speedDiff = targetSpeed - currentSpeed
  speedVelocity += speedDiff * SPEED_ACCELERATION
  speedVelocity *= SPEED_DAMPING
  currentSpeed += speedVelocity
  currentSpeed = Math.max(MIN_SPEED, Math.min(FULL_SPEED, currentSpeed))

  // 星际穿越效果 - 星星向相机移动
  const positions = starsGeometry.attributes.position!.array as Float32Array
  const velocities = starsGeometry.attributes.velocity!.array as Float32Array

  for (let i = 0; i < positions.length / 3; i++) {
    const zIndex = i * 3 + 2
    const currentZ = positions[zIndex] ?? 0
    const velocity = velocities[i] ?? 0
    positions[zIndex] = currentZ + velocity * currentSpeed // 向前移动

    // 超过相机位置后重置到远处
    if ((positions[zIndex] ?? 0) > 100) {
      positions[zIndex] = -1000
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 800 + 100
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.sin(angle) * radius
    }
  }
  starsGeometry.attributes.position!.needsUpdate = true

  // 节点脉冲
  graphNodes.forEach((node, i) => {
    if (node.isRoute) {
      const pulse = 0.15 + Math.sin(t * 3 + i * 0.8) * 0.08
      ;(node.glow.material as THREE.MeshBasicMaterial).opacity = pulse
    }
  })

  renderer.render(scene, camera)
}

function onClick(event: MouseEvent) {
  if (isDragging) return

  pickRouteByPoint(event.clientX, event.clientY)
}

function pickRouteByPoint(clientX: number, clientY: number) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1
  mouse.y = -(clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)

  const routeMeshes = graphNodes.filter(n => n.isRoute).map(n => n.mesh)
  const intersects = raycaster.intersectObjects(routeMeshes, true)
  if (intersects.length > 0) {
    const target = intersects[0]!.object
    if (target.userData?.route) {
      router.push(target.userData.route)
    }
  }
}

function onMouseDown(event: MouseEvent) {
  isDragging = true
  previousMousePosition = { x: event.clientX, y: event.clientY }
  canvasRef.value!.style.cursor = 'grabbing'
}

function onMouseMove(event: MouseEvent) {
  tooltipX.value = event.clientX
  tooltipY.value = event.clientY

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  if (isDragging) {
    const deltaX = event.clientX - previousMousePosition.x
    const deltaY = event.clientY - previousMousePosition.y

    targetRotation.y += deltaX * 0.005
    targetRotation.x += deltaY * 0.005

    // 限制X轴旋转范围
    targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.x))

    previousMousePosition = { x: event.clientX, y: event.clientY }
  } else {
    // 悬停检测
    raycaster.setFromCamera(mouse, camera)
    const routeMeshes = graphNodes.filter(n => n.isRoute).map(n => n.mesh)
    const intersects = raycaster.intersectObjects(routeMeshes, true)

    // 重置
    graphNodes.forEach(n => {
      if (n.isRoute) {
        ;(n.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x00ffff)
        ;(n.glow.material as THREE.MeshBasicMaterial).opacity = 0.15
      }
    })

    if (intersects.length > 0) {
      const target = intersects[0]!.object
      const node = graphNodes.find(n => n.mesh === target)
      if (node) {
        hoveredNode.value = node
        ;(node.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff)
        ;(node.glow.material as THREE.MeshBasicMaterial).opacity = 0.5
        canvasRef.value!.style.cursor = 'pointer'
      }
    } else {
      hoveredNode.value = null
      canvasRef.value!.style.cursor = 'grab'
    }
  }
}

function onMouseUp() {
  isDragging = false
  canvasRef.value!.style.cursor = 'grab'
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length === 0) return

  const touch = event.touches[0]!
  isDragging = true
  touchMoved = false
  previousMousePosition = { x: touch.clientX, y: touch.clientY }
}

function onTouchMove(event: TouchEvent) {
  if (!isDragging || event.touches.length === 0) return

  const touch = event.touches[0]!
  tooltipX.value = touch.clientX
  tooltipY.value = touch.clientY
  const deltaX = touch.clientX - previousMousePosition.x
  const deltaY = touch.clientY - previousMousePosition.y

  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    touchMoved = true
  }

  targetRotation.y += deltaX * 0.005
  targetRotation.x += deltaY * 0.005
  targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRotation.x))

  previousMousePosition = { x: touch.clientX, y: touch.clientY }
  event.preventDefault()
}

function onTouchEnd(event: TouchEvent) {
  if (!isDragging) return

  isDragging = false
  if (!touchMoved && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0]!
    pickRouteByPoint(touch.clientX, touch.clientY)
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
</script>

<template>
  <div class="home">
    <canvas ref="canvasRef" class="canvas"></canvas>

    <div class="bg-grid"></div>
    <div class="scanline"></div>

    <div class="matrix-rain" aria-hidden="true">
      <span
        v-for="column in matrixColumns"
        :key="column.id"
        class="matrix-col"
        :style="{
          left: column.left,
          animationDuration: column.duration,
          animationDelay: column.delay,
        }"
      >
        {{ column.stream }}
      </span>
    </div>

    <div class="header">
      <h1>技数斋</h1>
      <p>Cyber Interface v2.6 · 探索未知 · 创造未来</p>
    </div>

    <section class="hud-panel panel-left">
      <h2>导航节点</h2>
      <p>拖拽旋转星图，点击高亮主节点进入对应模块。</p>
      <nav class="quick-links">
        <router-link to="/blog">博客</router-link>
        <router-link to="/projects">项目</router-link>
        <router-link to="/games">游戏</router-link>
        <router-link to="/about">关于</router-link>
        <router-link to="/contact">联系</router-link>
      </nav>
    </section>

    <section class="hud-panel panel-right">
      <h2>系统状态</h2>
      <div class="metric">
        <span>DATA FLOW</span>
        <i style="--pct: 88%"></i>
      </div>
      <div class="metric">
        <span>NEURAL MESH</span>
        <i style="--pct: 74%"></i>
      </div>
      <div class="metric">
        <span>NODE SYNC</span>
        <i style="--pct: 93%"></i>
      </div>
      <div class="metric">
        <span>RENDER FPS</span>
        <i style="--pct: 68%"></i>
      </div>
    </section>

    <div
      v-if="hoveredNode"
      class="tooltip"
      :style="{ left: `${tooltipX + 18}px`, top: `${tooltipY + 18}px` }"
    >
      {{ hoveredNode.label }}
    </div>

    <footer>
      技数斋 <a href="https://beian.miit.gov.cn/" target="_blank">皖ICP备2025076226号-1</a> | Copyright © 2025-present 贺墨于
    </footer>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  width: 100vw;
  min-height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 18%, rgba(102, 169, 255, 0.14), transparent 22%),
    radial-gradient(circle at 78% 14%, rgba(159, 111, 255, 0.16), transparent 20%),
    radial-gradient(circle at 50% 84%, rgba(83, 243, 255, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(2, 6, 15, 0.18), rgba(2, 5, 13, 0.82));
}

.home::before,
.home::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.home::before {
  background:
    radial-gradient(circle at 24% 22%, rgba(83, 243, 255, 0.08), transparent 16%),
    radial-gradient(circle at 76% 26%, rgba(159, 111, 255, 0.08), transparent 18%),
    radial-gradient(circle at 50% 70%, rgba(255, 104, 224, 0.04), transparent 22%);
  opacity: 0.9;
}

.home::after {
  background: radial-gradient(circle at center, transparent 18%, rgba(2, 6, 15, 0.18) 60%, rgba(2, 4, 9, 0.82) 100%);
}

.canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  overscroll-behavior: none;
  -webkit-user-select: none;
  user-select: none;
  z-index: 0;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(85, 231, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(85, 231, 255, 0.08) 1px, transparent 1px);
  background-size: 72px 72px;
  opacity: 0.16;
  pointer-events: none;
  z-index: 1;
  mask-image: radial-gradient(circle at center, black 34%, transparent 92%);
}

.scanline {
  position: absolute;
  inset: -180px 0 0;
  background: linear-gradient(to bottom, transparent, rgba(55, 206, 255, 0.18), transparent);
  animation: sweep 9s linear infinite;
  z-index: 2;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: 0.75;
}

.matrix-rain {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 0.18;
}

.matrix-col {
  position: absolute;
  top: -70%;
  color: rgba(117, 255, 242, 0.68);
  font-size: 12px;
  letter-spacing: 1px;
  writing-mode: vertical-rl;
  text-orientation: upright;
  text-shadow: 0 0 8px rgba(92, 255, 233, 0.7);
  animation-name: rain;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.header {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 4;
  width: min(390px, calc(100vw - 48px));
  padding: 20px 22px;
  border: 1px solid rgba(137, 198, 255, 0.24);
  border-radius: 24px;
  background: linear-gradient(160deg, rgba(10, 18, 33, 0.84), rgba(6, 14, 26, 0.58));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 18px 48px rgba(0, 0, 0, 0.34),
    0 0 36px rgba(83, 243, 255, 0.16);
  overflow: hidden;
  pointer-events: none;
}

.header::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(159, 111, 255, 0.16), transparent 34%),
    radial-gradient(circle at bottom left, rgba(83, 243, 255, 0.1), transparent 36%);
  pointer-events: none;
}

.header h1 {
  font-size: clamp(2.35rem, 5vw, 4.8rem);
  line-height: 0.96;
  letter-spacing: 0.1em;
  text-shadow: 0 0 20px rgba(83, 243, 255, 0.3), 0 0 44px rgba(159, 111, 255, 0.18);
  animation: breatheText 5s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

.header p {
  margin-top: 10px;
  color: rgba(201, 227, 255, 0.74);
  font-size: 0.78rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}

.hud-panel {
  position: absolute;
  z-index: 4;
  width: min(340px, calc(100vw - 32px));
  padding: 16px 18px;
  border: 1px solid rgba(135, 228, 255, 0.22);
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(5, 16, 34, 0.64), rgba(18, 17, 34, 0.42));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 16px 44px rgba(0, 0, 0, 0.28),
    0 0 28px rgba(159, 111, 255, 0.12);
  overflow: hidden;
}

.hud-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(159, 111, 255, 0.16), transparent 34%),
    radial-gradient(circle at bottom left, rgba(83, 243, 255, 0.1), transparent 36%);
  pointer-events: none;
}

.hud-panel h2 {
  position: relative;
  z-index: 1;
  margin-bottom: 10px;
  color: var(--cyan);
  font-size: 0.84rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.hud-panel p {
  position: relative;
  z-index: 1;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.65;
}

.panel-left {
  left: 24px;
  bottom: 24px;
}

.panel-right {
  right: 24px;
  top: 24px;
}

.quick-links {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  position: relative;
  z-index: 1;
}

.quick-links a {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 8px 10px;
  font-size: 12px;
  text-align: center;
  border: 1px solid rgba(129, 223, 255, 0.24);
  border-radius: 10px;
  color: rgba(236, 250, 255, 0.92);
  background: linear-gradient(180deg, rgba(30, 73, 102, 0.24), rgba(10, 22, 38, 0.54));
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease,
    background 180ms ease;
}

.quick-links a:hover {
  transform: translateY(-2px);
  border-color: rgba(116, 250, 255, 0.82);
  box-shadow: 0 0 18px rgba(79, 253, 255, 0.32);
  color: #fff;
  background: linear-gradient(180deg, rgba(46, 99, 138, 0.3), rgba(12, 28, 48, 0.66));
}

.metric {
  position: relative;
  z-index: 1;
  margin: 12px 0 0;
}

.metric span {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  letter-spacing: 2px;
  color: rgba(175, 223, 255, 0.9);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.metric i {
  display: block;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: rgba(92, 132, 180, 0.26);
  overflow: hidden;
  position: relative;
}

.metric i::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--pct);
  background: linear-gradient(90deg, var(--cyan), var(--blue), var(--violet));
  box-shadow: 0 0 12px rgba(56, 255, 241, 0.55);
}

.tooltip {
  position: fixed;
  padding: 10px 14px;
  background: rgba(7, 16, 30, 0.84);
  border: 1px solid rgba(83, 243, 255, 0.36);
  border-radius: 12px;
  font-size: 0.88rem;
  color: var(--cyan);
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 0 26px rgba(83, 243, 255, 0.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

footer {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 4;
  padding: 10px 16px;
  border: 1px solid rgba(91, 228, 255, 0.14);
  border-radius: 999px;
  background: rgba(7, 16, 30, 0.66);
  color: rgba(201, 227, 255, 0.72);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-align: center;
  max-width: calc(100vw - 24px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

footer a {
  color: var(--cyan);
}

@keyframes breatheText {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.045);
  }
}

@keyframes sweep {
  0% {
    transform: translateY(-100%);
  }

  100% {
    transform: translateY(120%);
  }
}

@keyframes rain {
  0% {
    transform: translateY(-20%);
    opacity: 0;
  }

  15% {
    opacity: 0.8;
  }

  90% {
    opacity: 0.5;
  }

  100% {
    transform: translateY(170%);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .header h1,
  .scanline,
  .matrix-col,
  body::after {
    animation: none;
  }
}

@media (max-width: 900px) {
  .header {
    left: 16px;
    top: 16px;
    width: calc(100vw - 32px);
  }

  .panel-right {
    top: auto;
    right: 16px;
    bottom: 150px;
    width: calc(100vw - 32px);
  }

  .panel-left {
    left: 16px;
    bottom: 16px;
    width: calc(100vw - 32px);
  }

  .quick-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .matrix-rain {
    opacity: 0.12;
  }

  .tooltip {
    max-width: calc(100vw - 24px);
  }

  footer {
    width: calc(100vw - 24px);
    line-height: 1.5;
    font-size: 10px;
  }
}
</style>
