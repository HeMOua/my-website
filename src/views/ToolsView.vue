<script setup lang="ts">
</script>

<template>
  <div class="page">
    <h1>工具</h1>
    <p>在线工具建设中...</p>
    <router-link to="/">返回首页</router-link>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  gap: 16px;
}

h1 {
  font-size: 48px;
  text-shadow: 0 0 20px cyan;
}

p {
  opacity: 0.6;
  font-size: 18px;
}

a {
  margin-top: 24px;
  color: cyan;
  border: 1px solid rgba(0, 255, 255, 0.4);
  padding: 8px 24px;
  border-radius: 6px;
  transition: all 0.3s;
}

a:hover {
  background: rgba(0, 255, 255, 0.15);
}
</style>
