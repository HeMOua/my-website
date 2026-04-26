<script setup lang="ts">
const categories = [
  {
    name: '在线游戏',
    icon: '🌐',
    games: [
      { name: '2048', route: '/games/2048', desc: '滑动合并，挑战最高分', tech: 'Vue' },
      { name: '拼图 15', route: '/games/puzzle', desc: '4×4 滑块拼图', tech: 'Vue' },
      { name: '记忆力翻牌', route: '/games/memory', desc: '翻牌配对记忆挑战', tech: 'Vue' },
      { name: '井字棋', route: '/games/tic-tac-toe', desc: '经典三连棋对战', tech: 'Vue' },
    ],
  },
  {
    name: '在线游戏（动作）',
    icon: '⚡',
    games: [
      { name: '贪吃蛇', route: '/games/snake', desc: '控制蛇吃食物不断增长', tech: 'Canvas' },
      { name: 'Flappy Bird', route: '/games/flappy-bird', desc: '点击飞行躲避管道', tech: 'Canvas' },
      { name: '接住掉落', route: '/games/catch', desc: '移动篮子接住物品', tech: 'Canvas' },
      { name: '躲避障碍', route: '/games/dodge', desc: '灵活走位躲避障碍物', tech: 'Canvas' },
    ],
  },
  {
    name: '在线游戏（街机）',
    icon: '🕹️',
    games: [
      { name: '俄罗斯方块', route: '/games/tetris', desc: '经典方块下落消除', tech: 'Canvas' },
      { name: '打砖块', route: '/games/breakout', desc: '弹球击碎所有砖块', tech: 'Canvas' },
    ],
  },
  {
    name: '联机游戏',
    icon: '🤝',
    games: [
      { name: '联机五子棋', route: '/games/gomoku-online', desc: '创建房间后邀请好友进行实时对战', tech: 'WebSocket' },
      { name: '排行榜联机赛（规划中）', desc: '按周赛积分，支持战绩回放', tech: 'Realtime DB' },
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
          统一管理在线游戏与联机游戏两个子节点。
        </p>
      </div>

      <div class="games-hero__meta">
        <div class="hero-stat">
          <strong>02</strong>
          <span>主子节点</span>
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
          <component
            :is="game.route ? 'router-link' : 'article'"
            v-for="game in cat.games"
            :key="`${cat.name}-${game.name}`"
            :to="game.route"
            class="game-card"
            :class="{ 'is-disabled': !game.route }"
          >
            <div class="game-card__title">{{ game.name }}</div>
            <div class="game-card__desc">{{ game.desc }}</div>
            <span class="game-card__tech">{{ game.tech }}</span>
          </component>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.games-page {
  width: min(1260px, calc(100vw - 32px));
  margin: 24px auto 48px;
  padding: clamp(22px, 3vw, 32px);
  border-radius: 30px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  background:
    linear-gradient(160deg, rgba(10, 18, 33, 0.92), rgba(5, 11, 21, 0.74)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 80px rgba(0, 0, 0, 0.42);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.games-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(83, 243, 255, 0.16), transparent 30%),
    radial-gradient(circle at top right, rgba(159, 111, 255, 0.16), transparent 32%);
  pointer-events: none;
}

.games-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: end;
  padding-bottom: 24px;
  margin-bottom: 26px;
  border-bottom: 1px solid rgba(91, 228, 255, 0.16);
  position: relative;
  z-index: 1;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--cyan);
  font-size: 0.86rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.84;
  transition: opacity 180ms ease, transform 180ms ease, color 180ms ease;
}

.back-link:hover {
  opacity: 1;
  transform: translateX(-2px);
  color: #fff;
}

.games-hero__title {
  margin-top: 16px;
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  line-height: 0.96;
  letter-spacing: 0.08em;
}

.games-hero__lead {
  margin-top: 14px;
  max-width: 58ch;
  color: var(--muted);
  line-height: 1.8;
}

.games-hero__meta {
  display: grid;
  gap: 12px;
  min-width: min(320px, 100%);
}

.hero-stat {
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  background: rgba(7, 16, 30, 0.58);
}

.hero-stat strong {
  display: block;
  font-size: 1.2rem;
  letter-spacing: 0.08em;
}

.hero-stat span {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.76rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.games-grid {
  display: grid;
  gap: 22px;
  position: relative;
  z-index: 1;
}

.games-section__title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--cyan);
  font-size: 0.96rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 168px;
  gap: 10px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(91, 228, 255, 0.16);
  background:
    linear-gradient(160deg, rgba(14, 26, 49, 0.86), rgba(7, 16, 30, 0.66)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
  color: var(--text);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.26), 0 0 24px rgba(83, 243, 255, 0.2);
  overflow: hidden;
  transition: transform 180ms ease, border-color 180ms ease;
}

.game-card:hover {
  transform: translateY(-4px) scale(1.01);
  border-color: rgba(83, 243, 255, 0.46);
}

.game-card.is-disabled {
  opacity: 0.72;
  cursor: default;
}

.game-card.is-disabled:hover {
  transform: none;
}

.game-card__title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.game-card__desc {
  flex: 1;
  color: var(--muted);
  line-height: 1.7;
  font-size: 0.94rem;
}

.game-card__tech {
  align-self: flex-end;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(83, 243, 255, 0.2);
  background: rgba(83, 243, 255, 0.08);
  color: var(--cyan);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

@media (max-width: 860px) {
  .games-hero {
    grid-template-columns: 1fr;
  }

  .games-hero__meta {
    min-width: 0;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
}

@media (max-width: 640px) {
  .games-page {
    width: calc(100vw - 20px);
    border-radius: 22px;
  }
}
</style>
