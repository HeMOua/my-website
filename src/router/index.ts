import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/blog',
      name: 'blog',
      component: () => import('../views/BlogView.vue'),
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('../views/ContactView.vue'),
    },
    {
      path: '/games',
      name: 'games',
      component: () => import('../views/games/GamesView.vue'),
    },
    {
      path: '/games/2048',
      name: 'game-2048',
      component: () => import('../views/games/Game2048View.vue'),
    },
    {
      path: '/games/snake',
      name: 'game-snake',
      component: () => import('../views/games/GameSnakeView.vue'),
    },
    {
      path: '/games/flappy-bird',
      name: 'game-flappy-bird',
      component: () => import('../views/games/GameFlappyBirdView.vue'),
    },
    {
      path: '/games/tetris',
      name: 'game-tetris',
      component: () => import('../views/games/GameTetrisView.vue'),
    },
    {
      path: '/games/breakout',
      name: 'game-breakout',
      component: () => import('../views/games/GameBreakoutView.vue'),
    },
    {
      path: '/games/memory',
      name: 'game-memory',
      component: () => import('../views/games/GameMemoryView.vue'),
    },
    {
      path: '/games/tic-tac-toe',
      name: 'game-tic-tac-toe',
      component: () => import('../views/games/GameTicTacToeView.vue'),
    },
    {
      path: '/games/puzzle',
      name: 'game-puzzle',
      component: () => import('../views/games/GamePuzzleView.vue'),
    },
    {
      path: '/games/catch',
      name: 'game-catch',
      component: () => import('../views/games/GameCatchView.vue'),
    },
    {
      path: '/games/dodge',
      name: 'game-dodge',
      component: () => import('../views/games/GameDodgeView.vue'),
    },
  ],
})

export default router
