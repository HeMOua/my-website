<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
let routeMeshes: THREE.Mesh[] = []
let hoveredNode = ref<GraphNode | null>(null)
let activeRouteNode: GraphNode | null = null
const tooltipPosition = ref({ x: 0, y: 0 })
let motionQuery: MediaQueryList | null = null
let prefersReducedMotion = false
const isMobileViewport = ref(false)
const isHudCollapsed = ref(false)
const isStatusCollapsed = ref(false)

const TARGET_FPS = 45
const FRAME_INTERVAL = 1000 / TARGET_FPS
let lastFrameTime = 0

// 拖拽控制
let isDragging = false
let previousMousePosition = { x: 0, y: 0 }
let targetRotation = { x: 0, y: 0 }
let currentRotation = { x: 0, y: 0 }

// 飞行速度控制（加速度模型）
const FULL_SPEED = 3.2
const MIN_SPEED = 0.12
let currentSpeed = FULL_SPEED
let speedVelocity = 0 // 速度的变化率（加速度）
const SPEED_ACCELERATION = 0.014 // 加速度
const SPEED_DAMPING = 0.88 // 阻尼

// 图谱结构：中心节点 -> 主节点 -> 子节点
const graphConfig = {
  center: { label: '技数斋' },
  mainNodes: [
    { label: '博客', route: '/blog', children: ['前端', '后端', '人工智能'] },
    { label: '项目', route: '/projects', children: ['开源', '工具库', 'Demo'] },
    { label: '游戏', route: '/games', children: ['在线游戏', '联机游戏'] },
    { label: '关于与联系', route: '/about', children: ['简介', '合作方式', '联系方式'] },
  ],
}

const mainNodeCountLabel = computed(() => graphConfig.mainNodes.length.toString().padStart(2, '0'))

onMounted(() => {
  syncViewportState()
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion = motionQuery.matches
  motionQuery.addEventListener('change', onMotionPreferenceChange)

  initThree()
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibilityChange)
  canvasRef.value?.addEventListener('click', onClick)
  canvasRef.value?.addEventListener('pointerdown', onPointerDown)
  canvasRef.value?.addEventListener('pointermove', onPointerMove)
  canvasRef.value?.addEventListener('pointerup', onPointerUp)
  canvasRef.value?.addEventListener('pointerleave', onPointerLeave)
  canvasRef.value?.addEventListener('pointercancel', onPointerUp)
  canvasRef.value?.addEventListener('lostpointercapture', onPointerUp)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  motionQuery?.removeEventListener('change', onMotionPreferenceChange)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  canvasRef.value?.removeEventListener('click', onClick)
  canvasRef.value?.removeEventListener('pointerdown', onPointerDown)
  canvasRef.value?.removeEventListener('pointermove', onPointerMove)
  canvasRef.value?.removeEventListener('pointerup', onPointerUp)
  canvasRef.value?.removeEventListener('pointerleave', onPointerLeave)
  canvasRef.value?.removeEventListener('pointercancel', onPointerUp)
  canvasRef.value?.removeEventListener('lostpointercapture', onPointerUp)
  renderer?.dispose()
})

function onMotionPreferenceChange(event: MediaQueryListEvent) {
  prefersReducedMotion = event.matches
  if (prefersReducedMotion) {
    speedVelocity = 0
    currentSpeed = MIN_SPEED
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    speedVelocity = 0
  }
}

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
  const canvas = canvasRef.value
  if (!canvas) return

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', canvas })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight)

  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  // 星际穿越星空 - 星星分布在Z轴上，从远到近
  const isSmallScreen = window.innerWidth <= 768
  const starsCount = prefersReducedMotion ? 420 : isSmallScreen ? 900 : 1400
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
    const currentNode = mainNodes[i]!
    const nextNode = mainNodes[(i + 1) % mainNodes.length]!
    createEdge(currentNode.position, nextNode.position, 0.1)
  }

  routeMeshes = graphNodes.filter(n => n.isRoute).map(n => n.mesh)

  camera.position.z = 8
  animate()
}

function setHoveredRouteNode(node: GraphNode | null) {
  if (activeRouteNode === node) {
    hoveredNode.value = node
    return
  }

  if (activeRouteNode) {
    ;(activeRouteNode.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x00ffff)
    ;(activeRouteNode.glow.material as THREE.MeshBasicMaterial).opacity = 0.15
  }

  activeRouteNode = node
  hoveredNode.value = node

  if (activeRouteNode) {
    ;(activeRouteNode.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffffff)
    ;(activeRouteNode.glow.material as THREE.MeshBasicMaterial).opacity = 0.5
  }
}

function animate(time = 0) {
  animationId = requestAnimationFrame(animate)
  if (document.hidden) return

  const elapsed = time - lastFrameTime
  if (elapsed < FRAME_INTERVAL) return
  lastFrameTime = time

  const t = time * 0.001

  // 平滑旋转
  currentRotation.x += (targetRotation.x - currentRotation.x) * 0.08
  currentRotation.y += (targetRotation.y - currentRotation.y) * 0.08

  graphGroup.rotation.x = currentRotation.x
  graphGroup.rotation.y = currentRotation.y

  // 呼吸缩放
  if (!prefersReducedMotion) {
    const scale = 1 + Math.sin(t * 1.5) * 0.05
    graphGroup.scale.set(scale, scale, scale)
  }

  // 飞行速度 - 加速度模型
  const targetSpeed = isDragging ? MIN_SPEED : FULL_SPEED
  const speedDiff = targetSpeed - currentSpeed
  speedVelocity += speedDiff * SPEED_ACCELERATION
  speedVelocity *= SPEED_DAMPING
  currentSpeed += speedVelocity
  currentSpeed = Math.max(MIN_SPEED, Math.min(FULL_SPEED, currentSpeed))

  // 星际穿越效果 - 星星向相机移动
  const positionAttribute = starsGeometry.getAttribute('position') as THREE.BufferAttribute
  const velocityAttribute = starsGeometry.getAttribute('velocity') as THREE.BufferAttribute
  const positions = positionAttribute.array as Float32Array
  const velocities = velocityAttribute.array as Float32Array

  for (let i = 0; i < positions.length / 3; i++) {
    const baseIndex = i * 3
    const depthIndex = baseIndex + 2
    positions[depthIndex]! += velocities[i]! * currentSpeed // 向前移动

    // 超过相机位置后重置到远处
    if (positions[depthIndex]! > 100) {
      positions[depthIndex]! = -1000
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 800 + 100
      positions[baseIndex]! = Math.cos(angle) * radius
      positions[baseIndex + 1]! = Math.sin(angle) * radius
    }
  }
  positionAttribute.needsUpdate = true

  // 节点脉冲
  if (!prefersReducedMotion) {
    graphNodes.forEach((node, i) => {
      if (node.isRoute) {
        const pulse = 0.15 + Math.sin(t * 3 + i * 0.8) * 0.08
        ;(node.glow.material as THREE.MeshBasicMaterial).opacity = pulse
      }
    })
  }

  renderer.render(scene, camera)
}

function onClick(event: MouseEvent) {
  if (isDragging) return

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObjects(routeMeshes, true)
  if (intersects.length > 0) {
    const target = intersects[0]?.object
    if (target?.userData?.route) {
      router.push(target.userData.route)
    }
  }
}

function onPointerDown(event: PointerEvent) {
  isDragging = true
  speedVelocity = 0
  previousMousePosition = { x: event.clientX, y: event.clientY }
  canvasRef.value?.setPointerCapture(event.pointerId)
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grabbing'
  }
}

function onPointerMove(event: PointerEvent) {
  updateTooltipPosition(event.clientX, event.clientY)

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
    const intersects = raycaster.intersectObjects(routeMeshes, true)

    if (intersects.length > 0) {
      const target = intersects[0]?.object
      const node = graphNodes.find(n => n.mesh === target)
      if (node) {
        setHoveredRouteNode(node)
        canvasRef.value!.style.cursor = 'pointer'
      }
    } else {
      setHoveredRouteNode(null)
      if (canvasRef.value) {
        canvasRef.value.style.cursor = 'grab'
      }
    }
  }
}

function onPointerUp(event: PointerEvent) {
  isDragging = false
  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId)
  }
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grab'
  }
}

function onPointerLeave() {
  isDragging = false
  setHoveredRouteNode(null)
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'grab'
  }
}

function updateTooltipPosition(clientX: number, clientY: number) {
  const tooltipOffsetX = 16
  const tooltipOffsetY = 18
  const tooltipWidth = 180
  const tooltipHeight = 44
  const maxX = window.innerWidth - tooltipWidth - 8
  const maxY = window.innerHeight - tooltipHeight - 8

  tooltipPosition.value = {
    x: Math.max(8, Math.min(clientX + tooltipOffsetX, maxX)),
    y: Math.max(8, Math.min(clientY + tooltipOffsetY, maxY)),
  }
}

function onResize() {
  syncViewportState()
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function syncViewportState() {
  isMobileViewport.value = window.innerWidth <= 768
  if (!isMobileViewport.value) {
    isHudCollapsed.value = false
    isStatusCollapsed.value = false
  }
}

function toggleHudPanel() {
  if (!isMobileViewport.value) return
  isHudCollapsed.value = !isHudCollapsed.value
}

function toggleStatusPanel() {
  if (!isMobileViewport.value) return
  isStatusCollapsed.value = !isStatusCollapsed.value
}

function navigateToRoute(route?: string) {
  if (!route) return
  router.push(route)
}
</script>

<template>
  <div class="home">
    <div class="home__grid"></div>
    <div class="home__vignette"></div>
    <canvas ref="canvasRef" class="canvas"></canvas>

    <section class="home__hud" :class="{ 'is-collapsed': isMobileViewport && isHudCollapsed }">
      <div class="home__panel-head">
        <div class="eyebrow home__eyebrow">未来导航</div>
        <button
          class="home__panel-toggle"
          type="button"
          :aria-expanded="!isHudCollapsed"
          @click="toggleHudPanel"
        >
          {{ isHudCollapsed ? '展开' : '压缩' }}
        </button>
      </div>

      <div v-show="!isMobileViewport || !isHudCollapsed" class="home__panel-body">
        <h1>技数斋</h1>
        <p>探索未知 · 创造未来</p>

        <div class="home__chips">
          <span>三维星图</span>
          <span>霓虹图谱</span>
          <span>HUD 界面</span>
        </div>

        <div class="home__main-nav">
          <div class="home__main-nav-title">主节点导航</div>
          <div class="home__main-nav-list">
            <button
              v-for="node in graphConfig.mainNodes"
              :key="node.label"
              class="home__main-nav-item"
              :class="{ 'is-active': hoveredNode?.label === node.label }"
              type="button"
              @click="navigateToRoute(node.route)"
            >
              <span class="home__main-nav-dot"></span>
              <span class="home__main-nav-label">{{ node.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <aside class="home__status" :class="{ 'is-collapsed': isMobileViewport && isStatusCollapsed }">
      <div class="home__panel-head">
        <div class="home__status-title">系统面板</div>
        <button
          class="home__panel-toggle"
          type="button"
          :aria-expanded="!isStatusCollapsed"
          @click="toggleStatusPanel"
        >
          {{ isStatusCollapsed ? '展开' : '压缩' }}
        </button>
      </div>
      <div v-show="!isMobileViewport || !isStatusCollapsed" class="home__status-grid">
        <div>
          <strong>{{ mainNodeCountLabel }}</strong>
          <span>主节点</span>
        </div>
        <div>
          <strong>01</strong>
          <span>核心节点</span>
        </div>
        <div>
          <strong>∞</strong>
          <span>动态星轨</span>
        </div>
      </div>
    </aside>

    <div
      v-if="hoveredNode"
      class="home__tooltip"
      :style="{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }"
    >
      {{ hoveredNode.label }}
    </div>

    <footer class="home__footer">
      技数斋 <a href="https://beian.miit.gov.cn/" target="_blank">皖ICP备2025076226号-1</a> | Copyright © 2025-present 贺墨于
    </footer>
  </div>
</template>

<style scoped>
.home {
  --home-bottom-safe: 14px;
  --home-bottom-gap: 12px;
  --home-footer-height: 44px;
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 38%, rgba(83, 243, 255, 0.06), transparent 22%),
    radial-gradient(circle at 76% 24%, rgba(159, 111, 255, 0.08), transparent 18%),
    linear-gradient(180deg, rgba(2, 6, 15, 0.2), rgba(2, 5, 13, 0.72));
}

.home__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(83, 243, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(83, 243, 255, 0.08) 1px, transparent 1px);
  background-size: 84px 84px;
  opacity: 0.2;
  pointer-events: none;
  mask-image: linear-gradient(180deg, transparent 0%, black 18%, black 82%, transparent 100%);
}

.home__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at center, transparent 20%, rgba(2, 6, 15, 0.22) 60%, rgba(2, 4, 9, 0.8) 100%);
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

.home__hud {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 2;
  width: min(360px, calc(100vw - 48px));
  padding: 22px 24px;
  border: 1px solid rgba(91, 228, 255, 0.18);
  border-radius: 24px;
  background: linear-gradient(160deg, rgba(10, 18, 33, 0.76), rgba(6, 14, 26, 0.54));
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.34), 0 0 36px rgba(83, 243, 255, 0.16);
  overflow: hidden;
  pointer-events: none;
}

.home__hud::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(159, 111, 255, 0.18), transparent 34%),
    radial-gradient(circle at bottom left, rgba(83, 243, 255, 0.12), transparent 36%);
  pointer-events: none;
}

.home__hud h1 {
  margin-top: 14px;
  font-size: clamp(2.3rem, 5vw, 4.7rem);
  line-height: 0.96;
  letter-spacing: 0.1em;
  text-shadow: 0 0 20px rgba(83, 243, 255, 0.3), 0 0 44px rgba(159, 111, 255, 0.18);
  animation: breatheText 4s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

.home__hud p {
  margin-top: 10px;
  color: rgba(201, 227, 255, 0.72);
  font-size: 0.8rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}

.home__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(91, 228, 255, 0.22);
  background: rgba(83, 243, 255, 0.08);
  color: var(--cyan);
  font-size: 0.74rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}

.home__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.home__panel-body {
  position: relative;
  z-index: 1;
}

.home__panel-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(83, 243, 255, 0.24);
  background: rgba(7, 16, 30, 0.62);
  color: var(--cyan);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 180ms ease, background-color 180ms ease, color 180ms ease;
}

.home__panel-toggle:hover {
  border-color: rgba(83, 243, 255, 0.52);
  background: rgba(7, 16, 30, 0.84);
  color: #fff;
}

.home__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
  position: relative;
  z-index: 1;
}

.home__chips span {
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(91, 228, 255, 0.15);
  background: rgba(8, 16, 31, 0.72);
  color: rgba(237, 247, 255, 0.84);
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.home__main-nav {
  margin-top: 16px;
  position: relative;
  z-index: 1;
  pointer-events: auto;
}

.home__main-nav-title {
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.home__main-nav-list {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.home__main-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  background: rgba(7, 16, 30, 0.66);
  color: rgba(237, 247, 255, 0.88);
  text-align: left;
  cursor: pointer;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.home__main-nav-item:hover {
  border-color: rgba(83, 243, 255, 0.46);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24), 0 0 20px rgba(83, 243, 255, 0.14);
}

.home__main-nav-item.is-active {
  border-color: rgba(83, 243, 255, 0.56);
  box-shadow: 0 0 22px rgba(83, 243, 255, 0.22);
}

.home__main-nav-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--cyan);
  box-shadow: 0 0 10px rgba(83, 243, 255, 0.7);
  flex-shrink: 0;
}

.home__main-nav-label {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
}

.home__status {
  position: absolute;
  bottom: calc(var(--home-bottom-safe) + var(--home-footer-height) + var(--home-bottom-gap));
  right: 24px;
  z-index: 2;
  width: min(300px, calc(100vw - 48px));
  padding: 18px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  border-radius: 22px;
  background: linear-gradient(160deg, rgba(10, 18, 33, 0.7), rgba(6, 14, 26, 0.46));
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3), 0 0 24px rgba(83, 243, 255, 0.12);
  overflow: hidden;
  pointer-events: none;
}

.home__status-title {
  font-size: 0.76rem;
  color: var(--cyan);
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.home__status-grid {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.home__status-grid div {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(91, 228, 255, 0.12);
  background: rgba(7, 16, 30, 0.58);
}

.home__status-grid strong {
  display: block;
  font-size: 1.3rem;
  letter-spacing: 0.08em;
}

.home__status-grid span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.home__tooltip {
  position: fixed;
  padding: 10px 14px;
  background: rgba(7, 16, 30, 0.82);
  border: 1px solid rgba(83, 243, 255, 0.36);
  border-radius: 12px;
  font-size: 0.88rem;
  color: var(--cyan);
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 0 26px rgba(83, 243, 255, 0.18);
}

.home__footer {
  position: fixed;
  left: 50%;
  bottom: var(--home-bottom-safe);
  transform: translateX(-50%);
  z-index: 2;
  padding: 10px 16px;
  border: 1px solid rgba(91, 228, 255, 0.14);
  border-radius: 999px;
  background: rgba(7, 16, 30, 0.64);
  color: rgba(201, 227, 255, 0.72);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-align: center;
  max-width: calc(100vw - 24px);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3), 0 0 24px rgba(83, 243, 255, 0.12);
}

.home__footer a {
  color: var(--cyan);
}

.home__hud,
.home__status,
.home__footer,
.home__tooltip {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

@keyframes breatheText {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.04);
  }
}

@media (max-width: 768px) {
  .home {
    display: flex;
    flex-direction: column;
    --home-bottom-safe: 0px;
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
    overflow-y: auto;
    padding: 16px 16px 14px;
  }

  .canvas {
    position: fixed;
    inset: 0;
  }

  .home__hud {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    padding: 18px;
    border-radius: 18px;
    pointer-events: auto;
  }

  .home__status {
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    bottom: auto;
    width: 100%;
    margin-top: auto;
    margin-bottom: var(--home-bottom-gap);
    border-radius: 18px;
    pointer-events: auto;
  }

  .home__footer {
    position: relative;
    left: auto;
    bottom: auto;
    transform: none;
    width: 100%;
    margin-top: 0;
    line-height: 1.5;
    font-size: 10px;
    pointer-events: auto;
  }

  .home__hud p {
    letter-spacing: 0.18em;
  }

  .home__panel-toggle {
    display: inline-flex;
  }

  .home__hud.is-collapsed,
  .home__status.is-collapsed {
    padding-bottom: 14px;
  }

  .home__main-nav-list {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home__hud h1 {
    animation: none;
  }
}
</style>
