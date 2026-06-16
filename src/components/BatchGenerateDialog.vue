<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import * as booksApi from '../services/booksApi'

type Phase = 'theme' | 'outline-loading' | 'outline' | 'running' | 'done' | 'error'

const props = defineProps<{
  running: boolean
  done: number
  total: number
  currentTopic: string
  error: string | null
}>()

const emit = defineEmits<{
  start: [topics: string[]]
  cancel: []
  close: []
}>()

const phase = ref<Phase>('theme')
const theme = ref('')
const outlineText = ref('')
const outlineError = ref<string | null>(null)

const parsedTopics = computed(() =>
  outlineText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

watch(
  () => props.running,
  (val) => {
    if (!val && phase.value === 'running') {
      phase.value = props.error ? 'error' : 'done'
    }
  },
)

async function handleGenerateOutline(): Promise<void> {
  if (!theme.value.trim()) return
  phase.value = 'outline-loading'
  outlineError.value = null
  try {
    const result = await booksApi.generateOutline(theme.value.trim())
    outlineText.value = result.titles.join('\n')
    phase.value = 'outline'
  } catch (error) {
    outlineError.value = error instanceof Error ? error.message : '生成失败。'
    phase.value = 'theme'
  }
}

function handleStart(): void {
  if (parsedTopics.value.length === 0) return
  phase.value = 'running'
  emit('start', parsedTopics.value)
}

function handleClose(): void {
  phase.value = 'theme'
  theme.value = ''
  outlineText.value = ''
  outlineError.value = null
  emit('close')
}
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="batch-generate-title">
    <div class="dialog batch-dialog">
      <h2 id="batch-generate-title">批量生成教案</h2>

      <!-- 第一步：输入主题 -->
      <template v-if="phase === 'theme'">
        <p>输入课程主题，AI 先生成大纲，再依次生成每篇教案。</p>
        <p v-if="outlineError" class="app-notice app-notice--error" role="alert">{{ outlineError }}</p>
        <input
          v-model="theme"
          type="text"
          placeholder="例如：Web 前端开发项目式教学"
          @keydown.enter="handleGenerateOutline"
        />
        <div class="dialog-actions">
          <button type="button" :disabled="!theme.trim()" @click="handleGenerateOutline">生成大纲</button>
          <button type="button" @click="handleClose">取消</button>
        </div>
      </template>

      <!-- 大纲生成中 -->
      <template v-else-if="phase === 'outline-loading'">
        <p>正在生成大纲…</p>
      </template>

      <!-- 第二步：确认/编辑大纲 -->
      <template v-else-if="phase === 'outline'">
        <p>AI 已生成以下大纲，可直接编辑后开始生成：</p>
        <textarea v-model="outlineText" class="batch-topics-input" rows="12" />
        <p class="batch-topics-count">共 {{ parsedTopics.length }} 个课题</p>
        <div class="dialog-actions">
          <button type="button" :disabled="parsedTopics.length === 0" @click="handleStart">开始生成</button>
          <button type="button" @click="phase = 'theme'">重新输入</button>
        </div>
      </template>

      <!-- 生成中 -->
      <template v-else-if="phase === 'running'">
        <p class="batch-progress-label">
          正在生成第 <strong>{{ done + 1 }}</strong> / {{ total }} 篇
        </p>
        <p class="batch-current-topic">{{ currentTopic }}</p>
        <div class="batch-progress-bar">
          <div class="batch-progress-fill" :style="{ width: `${(done / total) * 100}%` }" />
        </div>
        <div class="dialog-actions">
          <button type="button" @click="emit('cancel')">停止</button>
        </div>
      </template>

      <!-- 出错 -->
      <template v-else-if="phase === 'error'">
        <p class="app-notice app-notice--error" role="alert">{{ error }}</p>
        <p>已生成 {{ done }} / {{ total }} 篇，生成中止。</p>
        <div class="dialog-actions">
          <button type="button" @click="handleClose">关闭</button>
        </div>
      </template>

      <!-- 完成（含主动停止） -->
      <template v-else-if="phase === 'done'">
        <p>已生成 <strong>{{ done }}</strong> / {{ total }} 篇教案。</p>
        <div class="dialog-actions">
          <button type="button" @click="handleClose">关闭</button>
        </div>
      </template>
    </div>
  </div>
</template>
