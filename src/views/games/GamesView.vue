<script setup lang="ts">
const categories = [
  {
    name: '策略益智',
    icon: '🧠',
    games: [
      { name: '2048', route: '/games/2048', desc: '滑动合并，挑战最高分', tech: 'Vue' },
      { name: '拼图 15', route: '/games/puzzle', desc: '4×4 滑块拼图', tech: 'Vue' },
      { name: '记忆力翻牌', route: '/games/memory', desc: '翻牌配对记忆挑战', tech: 'Vue' },
      { name: '井字棋', route: '/games/tic-tac-toe', desc: '经典三连棋对战', tech: 'Vue' },
    ],
  },
  {
    name: '动作反应',
    icon: '⚡',
    games: [
      { name: '贪吃蛇', route: '/games/snake', desc: '控制蛇吃食物不断增长', tech: 'Canvas' },
      { name: 'Flappy Bird', route: '/games/flappy-bird', desc: '点击飞行躲避管道', tech: 'Canvas' },
      { name: '接住掉落', route: '/games/catch', desc: '移动篮子接住物品', tech: 'Canvas' },
      { name: '躲避障碍', route: '/games/dodge', desc: '灵活走位躲避障碍物', tech: 'Canvas' },
    ],
  },
  {
    name: '经典街机',
    icon: '🕹️',
    games: [
      { name: '俄罗斯方块', route: '/games/tetris', desc: '经典方块下落消除', tech: 'Canvas' },
      { name: '打砖块', route: '/games/breakout', desc: '弹球击碎所有砖块', tech: 'Canvas' },
    ],
  },
]
</script>

<template>
  <div class="games-page">
    <header class="games-hero">
      <div>
        <router-link to="/" class="back-link">&larr; 首页</router-link>
        <h1 class="games-hero__title">游戏中心</h1>
        <p class="games-hero__lead">
          从策略益智到经典街机。
        </p>
      </div>

      <div class="games-hero__meta">
        <div class="hero-stat">
          <strong>03</strong>
          <span>游戏类型</span>
        </div>
        <div class="hero-stat">
          <strong>10+</strong>
          <span>小游戏数量</span>
        </div>
      </div>
    </header>

    <div class="games-grid">
      <section v-for="cat in categories" :key="cat.name" class="category">
        <h2 class="games-section__title">{{ cat.icon }} {{ cat.name }}</h2>
        <div class="game-grid">
          <router-link v-for="game in cat.games" :key="game.route" :to="game.route" class="game-card">
            <div class="game-card__title">{{ game.name }}</div>
            <div class="game-card__desc">{{ game.desc }}</div>
            <span class="game-card__tech">{{ game.tech }}</span>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>
