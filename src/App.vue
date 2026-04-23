<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <div class="app-shell__glow app-shell__glow--cyan"></div>
    <div class="app-shell__glow app-shell__glow--violet"></div>
    <div class="app-shell__scanlines"></div>
    <router-view />
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  isolation: isolate;
}

.app-shell__glow {
  position: fixed;
  inset: auto;
  width: 42vw;
  height: 42vw;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.42;
  pointer-events: none;
  z-index: 0;
  animation: drift 20s ease-in-out infinite alternate;
}

.app-shell__glow--cyan {
  top: -12vw;
  left: -10vw;
  background: radial-gradient(circle, rgba(83, 243, 255, 0.32), transparent 68%);
}

.app-shell__glow--violet {
  right: -8vw;
  bottom: -14vw;
  background: radial-gradient(circle, rgba(159, 111, 255, 0.3), transparent 68%);
  animation-delay: -8s;
}

.app-shell__scanlines {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.08;
  background-image: linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 100% 4px;
  mix-blend-mode: screen;
}

@keyframes drift {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }

  100% {
    transform: translate3d(2.5%, -2%, 0) scale(1.06);
  }
}
</style>
