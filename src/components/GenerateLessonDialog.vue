<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [topic: string]
  cancel: []
}>()

const topic = ref('')

function submit(): void {
  const value = topic.value.trim()
  if (!value || props.loading) return
  emit('submit', value)
}
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="generate-lesson-title">
    <div class="dialog">
      <h2 id="generate-lesson-title">生成教案</h2>
      <p>输入主题，AI 将生成一份符合模板结构的教案，加入当前整本末尾。</p>
      <input
        v-model="topic"
        type="text"
        placeholder="例如：CSS 弹性布局入门"
        :disabled="loading"
        @keydown.enter="submit"
      />
      <p v-if="error" class="app-notice app-notice--error" role="alert">{{ error }}</p>
      <div class="dialog-actions">
        <button type="button" :disabled="loading || !topic.trim()" @click="submit">
          {{ loading ? '生成中…' : '生成' }}
        </button>
        <button type="button" :disabled="loading" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>
