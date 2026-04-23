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
    <header class="page-header">
      <router-link to="/" class="back">&larr; 首页</router-link>
      <h1>游戏中心</h1>
    </header>

    <div class="categories">
      <section v-for="cat in categories" :key="cat.name" class="category">
        <h2>{{ cat.icon }} {{ cat.name }}</h2>
        <div class="game-grid">
          <router-link v-for="game in cat.games" :key="game.route" :to="game.route" class="game-card">
            <div class="game-name">{{ game.name }}</div>
            <div class="game-desc">{{ game.desc }}</div>
            <span class="game-tech">{{ game.tech }}</span>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.games-page {
  min-height: 100vh;
  padding: 32px 40px;
  background: #0a0a0a;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 40px;
}

.back {
  color: cyan;
  font-size: 14px;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.back:hover {
  opacity: 1;
}

h1 {
  font-size: 32px;
  letter-spacing: 4px;
  text-shadow: 0 0 20px cyan;
}

.categories {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.category h2 {
  font-size: 20px;
  margin-bottom: 16px;
  color: rgba(0, 255, 255, 0.8);
  letter-spacing: 2px;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: rgba(0, 255, 255, 0.05);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 12px;
  text-decoration: none;
  color: white;
  transition: all 0.3s;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.05);
}

.game-card:hover {
  background: rgba(0, 255, 255, 0.12);
  border-color: rgba(0, 255, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
}

.game-name {
  font-size: 18px;
  font-weight: bold;
}

.game-desc {
  font-size: 13px;
  opacity: 0.6;
  flex: 1;
}

.game-tech {
  align-self: flex-end;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 255, 255, 0.15);
  color: cyan;
}
</style>
