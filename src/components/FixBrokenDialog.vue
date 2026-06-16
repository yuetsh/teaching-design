<script setup lang="ts">
import { ref, watch } from 'vue'

type Phase = 'confirm' | 'running' | 'done' | 'error'

const props = defineProps<{
  running: boolean
  done: number
  total: number
  currentTopic: string
  error: string | null
}>()

const emit = defineEmits<{
  start: []
  cancel: []
  close: []
}>()

const phase = ref<Phase>('confirm')

watch(
  () => props.running,
  (val) => {
    if (val) {
      phase.value = 'running'
    } else if (phase.value === 'running') {
      phase.value = props.error ? 'error' : 'done'
    }
  },
)

function handleClose(): void {
  phase.value = 'confirm'
  emit('close')
}
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="fix-dialog-title">
    <div class="dialog">
      <h2 id="fix-dialog-title">修复问题教案</h2>

      <!-- 确认 -->
      <template v-if="phase === 'confirm'">
        <p>共 <strong>{{ total }}</strong> 篇教案存在解析问题，点击开始将重新生成并原位替换。</p>
        <div class="dialog-actions">
          <button type="button" @click="emit('start')">开始修复</button>
          <button type="button" @click="emit('close')">取消</button>
        </div>
      </template>

      <!-- 修复中 -->
      <template v-else-if="phase === 'running'">
        <p class="batch-progress-label">
          正在修复第 <strong>{{ done + 1 }}</strong> / {{ total }} 篇
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
        <p>已修复 {{ done }} / {{ total }} 篇，修复中止。</p>
        <div class="dialog-actions">
          <button type="button" @click="handleClose">关闭</button>
        </div>
      </template>

      <!-- 完成 -->
      <template v-else-if="phase === 'done'">
        <p>已修复 <strong>{{ done }}</strong> / {{ total }} 篇教案。</p>
        <div class="dialog-actions">
          <button type="button" @click="handleClose">关闭</button>
        </div>
      </template>
    </div>
  </div>
</template>
