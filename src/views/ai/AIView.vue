<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownRender from 'markstream-vue'

import ragOverviewMd from '@/content/ai/rag/overview.md?raw'
import ragIngestionMd from '@/content/ai/rag/ingestion-and-indexing.md?raw'
import ragRetrievalMd from '@/content/ai/rag/retrieval-and-generation.md?raw'

import reactMd from '@/content/ai/agents/react.md?raw'
import planExecuteMd from '@/content/ai/agents/plan-execute.md?raw'
import reflexionMd from '@/content/ai/agents/reflexion.md?raw'

type MainTab = 'rag' | 'agent'

interface Topic {
  id: string
  title: string
  summary: string
  toc: string[]
  content: string
}

const mainTab = ref<MainTab>('rag')
const ragTab = ref('overview')
const agentTab = ref('react')

const ragTopics: Topic[] = [
  {
    id: 'overview',
    title: 'RAG 总览',
    summary: '定义、关键价值与适用边界。',
    toc: ['RAG 核心价值', '典型链路', '适用场景与边界'],
    content: ragOverviewMd,
  },
  {
    id: 'ingestion',
    title: '数据入库与索引',
    summary: '数据清洗、切分、Embedding 与索引策略。',
    toc: ['数据治理', '切片策略', '索引与更新'],
    content: ragIngestionMd,
  },
  {
    id: 'retrieval',
    title: '检索与生成',
    summary: '召回、重排、上下文拼装与答案生成。',
    toc: ['召回与重排', 'Prompt 组装', '评估与观测'],
    content: ragRetrievalMd,
  },
]

const agentTopics: Topic[] = [
  {
    id: 'react',
    title: 'ReAct',
    summary: '推理与行动交替执行的经典模式。',
    toc: ['工作机制', '适合任务', '风险与治理'],
    content: reactMd,
  },
  {
    id: 'plan-execute',
    title: 'Plan-Execute',
    summary: '先规划后执行，适合复杂工作流。',
    toc: ['工作机制', '适合任务', '风险与治理'],
    content: planExecuteMd,
  },
  {
    id: 'reflexion',
    title: 'Reflexion',
    summary: '通过反思闭环提升长期任务表现。',
    toc: ['工作机制', '适合任务', '风险与治理'],
    content: reflexionMd,
  },
]

const currentTopics = computed(() => (mainTab.value === 'rag' ? ragTopics : agentTopics))

const activeTopic = computed(() => {
  const selectedId = mainTab.value === 'rag' ? ragTab.value : agentTab.value
  return currentTopics.value.find(topic => topic.id === selectedId) ?? currentTopics.value[0]!
})

function switchMainTab(tab: MainTab) {
  mainTab.value = tab
}

function switchSubTab(topicId: string) {
  if (mainTab.value === 'rag') {
    ragTab.value = topicId
    return
  }

  agentTab.value = topicId
}
</script>

<template>
  <div class="ai-page">
    <header class="ai-page__hero">
      <div>
        <router-link to="/" class="back-link">&larr; 首页</router-link>
        <h1 class="ai-page__title">人工智能章节</h1>
        <p class="ai-page__lead">
          按照知识工程与智能体设计两条主线组织内容，聚焦 RAG 与 Agent 架构（ReAct / Plan-Execute / Reflexion）。
        </p>
      </div>
      <div class="ai-page__meta">
        <div class="hero-stat">
          <strong>02</strong>
          <span>主分类</span>
        </div>
        <div class="hero-stat">
          <strong>06</strong>
          <span>专题文档</span>
        </div>
      </div>
    </header>

    <section class="ai-page__tabs">
      <button
        class="ai-main-tab"
        :class="{ 'is-active': mainTab === 'rag' }"
        type="button"
        @click="switchMainTab('rag')"
      >
        RAG
      </button>
      <button
        class="ai-main-tab"
        :class="{ 'is-active': mainTab === 'agent' }"
        type="button"
        @click="switchMainTab('agent')"
      >
        Agent 架构
      </button>
    </section>

    <div class="ai-page__content">
      <aside class="ai-side">
        <h2 class="ai-side__title">目录</h2>

        <div class="ai-sub-tabs">
          <button
            v-for="topic in currentTopics"
            :key="topic.id"
            class="ai-sub-tab"
            :class="{ 'is-active': activeTopic.id === topic.id }"
            type="button"
            @click="switchSubTab(topic.id)"
          >
            <span class="ai-sub-tab__title">{{ topic.title }}</span>
            <span class="ai-sub-tab__summary">{{ topic.summary }}</span>
          </button>
        </div>

        <div class="ai-side__toc">
          <h3>当前章节小节</h3>
          <ul>
            <li v-for="item in activeTopic.toc" :key="item">{{ item }}</li>
          </ul>
        </div>
      </aside>

      <article class="ai-article">
        <MarkdownRender custom-id="ai-docs" :content="activeTopic.content" />
      </article>
    </div>
  </div>
</template>

<style scoped>
.ai-page {
  width: min(1320px, calc(100vw - 32px));
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

.ai-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top left, rgba(83, 243, 255, 0.12), transparent 30%),
    radial-gradient(circle at top right, rgba(159, 111, 255, 0.15), transparent 34%);
  pointer-events: none;
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

.ai-page__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: end;
  padding-bottom: 24px;
  margin-bottom: 22px;
  border-bottom: 1px solid rgba(91, 228, 255, 0.16);
  position: relative;
  z-index: 1;
}

.ai-page__title {
  margin-top: 16px;
  font-size: clamp(2.2rem, 4.8vw, 4rem);
  line-height: 0.98;
  letter-spacing: 0.08em;
}

.ai-page__lead {
  margin-top: 14px;
  max-width: 62ch;
  color: var(--muted);
  line-height: 1.8;
}

.ai-page__meta {
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

.ai-page__tabs {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.ai-main-tab {
  border: 1px solid rgba(91, 228, 255, 0.2);
  border-radius: 14px;
  padding: 10px 16px;
  background: rgba(8, 16, 31, 0.7);
  color: var(--text);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.ai-main-tab.is-active {
  border-color: rgba(83, 243, 255, 0.48);
  box-shadow: 0 0 28px rgba(83, 243, 255, 0.2);
}

.ai-main-tab:hover {
  transform: translateY(-1px);
}

.ai-page__content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 18px;
}

.ai-side {
  border: 1px solid rgba(91, 228, 255, 0.16);
  border-radius: 22px;
  background: rgba(8, 16, 31, 0.58);
  padding: 16px;
  display: grid;
  gap: 16px;
  height: fit-content;
}

.ai-side__title {
  font-size: 0.9rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--cyan);
}

.ai-sub-tabs {
  display: grid;
  gap: 10px;
}

.ai-sub-tab {
  border: 1px solid rgba(91, 228, 255, 0.16);
  border-radius: 14px;
  background: rgba(8, 16, 31, 0.8);
  color: var(--text);
  padding: 10px 12px;
  display: grid;
  gap: 6px;
  text-align: left;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.ai-sub-tab.is-active {
  border-color: rgba(83, 243, 255, 0.46);
  box-shadow: 0 0 22px rgba(83, 243, 255, 0.16);
}

.ai-sub-tab:hover {
  transform: translateX(2px);
}

.ai-sub-tab__title {
  font-weight: 650;
}

.ai-sub-tab__summary {
  color: var(--muted);
  font-size: 0.84rem;
}

.ai-side__toc {
  border-top: 1px solid rgba(91, 228, 255, 0.16);
  padding-top: 12px;
}

.ai-side__toc h3 {
  font-size: 0.76rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(201, 227, 255, 0.78);
  margin-bottom: 8px;
}

.ai-side__toc ul {
  list-style: none;
  display: grid;
  gap: 8px;
}

.ai-side__toc li {
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.ai-article {
  border: 1px solid rgba(91, 228, 255, 0.14);
  border-radius: 24px;
  background: rgba(7, 16, 30, 0.56);
  padding: clamp(14px, 2vw, 24px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  min-height: 560px;
}

.ai-article :deep(.markstream-vue) {
  background: transparent;
}

@media (max-width: 860px) {
  .ai-page__hero,
  .ai-page__content {
    grid-template-columns: 1fr;
  }

  .ai-page__meta {
    min-width: 0;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .ai-article {
    min-height: 420px;
  }
}

@media (max-width: 640px) {
  .ai-page {
    width: calc(100vw - 20px);
    border-radius: 22px;
  }
}
</style>
