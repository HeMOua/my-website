<script setup lang="ts">
</script>

<template>
  <div class="simple-page">
    <section class="simple-page__card">
      <div class="eyebrow">Profile node</div>
      <h1 class="simple-page__title">关于</h1>
      <p class="simple-page__lead">
        这里将承载个人简介、技术栈与时间线。当前页面先以高科技信息面板呈现，保持克制但更有沉浸感。
      </p>

      <div class="tag-row">
        <span class="tag">Identity</span>
        <span class="tag">Timeline</span>
        <span class="tag">Stack Map</span>
      </div>

      <div class="simple-page__actions">
        <router-link to="/" class="glass-button">返回首页</router-link>
      </div>
    </section>
  </div>
</template>
