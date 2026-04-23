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

    <div class="header">
      <h1>技数斋</h1>
      <p>探索未知 · 创造未来</p>
    </div>

    <div v-if="hoveredNode" class="tooltip">
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
  height: 100vh;
  overflow: hidden;
}

.canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.header {
  position: absolute;
  top: 32px;
  left: 40px;
  z-index: 1;
  pointer-events: none;
}

.header h1 {
  font-size: 36px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan, 0 0 40px cyan;
  animation: breatheText 4s ease-in-out infinite;
}

.header p {
  opacity: 0.6;
  font-size: 14px;
  margin-top: 8px;
  letter-spacing: 2px;
}

.tooltip {
  position: fixed;
  padding: 6px 14px;
  background: rgba(0, 255, 255, 0.15);
  border: 1px solid rgba(0, 255, 255, 0.4);
  border-radius: 6px;
  font-size: 14px;
  color: cyan;
  pointer-events: none;
  z-index: 10;
  backdrop-filter: blur(4px);
}

footer {
  position: fixed;
  bottom: 10px;
  width: 100%;
  text-align: center;
  font-size: 12px;
  opacity: 0.6;
  z-index: 2;
}

footer a {
  color: white;
  text-decoration: none;
}

@keyframes breatheText {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
</style>
