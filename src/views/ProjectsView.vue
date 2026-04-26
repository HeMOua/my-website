<script setup lang="ts">
</script>

<template>
  <div class="simple-page">
    <section class="simple-page__card">
      <div class="eyebrow">Workbench</div>
      <h1 class="simple-page__title">项目</h1>
      <p class="simple-page__lead">
        这里将展示作品集、实验项目和开源仓库。当前采用高对比玻璃面板，先把项目入口的观感提起来。
      </p>

      <div class="tag-row">
        <span class="tag">Open Source</span>
        <span class="tag">Demo</span>
        <span class="tag">Product</span>
      </div>

      <div class="simple-page__actions">
        <router-link to="/" class="glass-button">返回首页</router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.simple-page {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}

.simple-page__card {
  width: min(760px, calc(100vw - 32px));
  padding: clamp(28px, 4vw, 44px);
  border-radius: 28px;
  border: 1px solid rgba(91, 228, 255, 0.18);
  background:
    linear-gradient(145deg, rgba(10, 18, 33, 0.9), rgba(6, 13, 25, 0.72)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 24px 80px rgba(0, 0, 0, 0.46),
    0 0 24px rgba(83, 243, 255, 0.2),
    0 0 70px rgba(83, 243, 255, 0.1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.simple-page__card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(159, 111, 255, 0.22), transparent 34%),
    radial-gradient(circle at bottom left, rgba(83, 243, 255, 0.18), transparent 30%);
  pointer-events: none;
}

.eyebrow {
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
}

.simple-page__title {
  margin-top: 18px;
  font-size: clamp(2.4rem, 6vw, 4.8rem);
  line-height: 0.96;
  letter-spacing: 0.08em;
}

.simple-page__lead {
  margin-top: 16px;
  max-width: 56ch;
  color: var(--muted);
  line-height: 1.8;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: 999px;
  border: 1px solid rgba(91, 228, 255, 0.14);
  background: rgba(8, 16, 31, 0.72);
  color: rgba(237, 247, 255, 0.86);
  font-size: 0.82rem;
  letter-spacing: 0.06em;
}

.simple-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.glass-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 18px;
  border-radius: 14px;
  border: 1px solid rgba(91, 228, 255, 0.24);
  background: linear-gradient(135deg, rgba(83, 243, 255, 0.16), rgba(159, 111, 255, 0.14));
  color: var(--text);
}

@media (max-width: 640px) {
  .simple-page {
    padding: 18px 10px;
  }

  .simple-page__card {
    width: calc(100vw - 20px);
    border-radius: 22px;
  }

  .simple-page__actions {
    flex-direction: column;
  }

  .glass-button {
    width: 100%;
  }
}
</style>
