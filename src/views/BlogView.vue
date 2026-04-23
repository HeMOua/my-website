<script setup lang="ts">
</script>

<template>
  <div class="simple-page">
    <section class="simple-page__card">
      <div class="eyebrow">Signal log</div>
      <h1 class="simple-page__title">博客</h1>
      <p class="simple-page__lead">
        这里会放技术记录、思考笔记和项目复盘。现在先用更有未来感的杂志式信息块，作为内容入口。
      </p>

      <div class="tag-row">
        <span class="tag">Articles</span>
        <span class="tag">Notes</span>
        <span class="tag">Experiments</span>
      </div>

      <div class="simple-page__actions">
        <router-link to="/" class="glass-button">返回首页</router-link>
      </div>
    </section>
  </div>
</template>
