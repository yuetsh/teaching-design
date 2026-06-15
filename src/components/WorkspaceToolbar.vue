<script setup lang="ts">
import type { SaveStatus } from '../composables/useTeachingBook'

const props = defineProps<{
  lessonCount: number
  warningCount: number
  saveStatus: SaveStatus
}>()

defineEmits<{
  upload: []
  print: []
  export: []
  clear: []
}>()

const saveStatusLabel: Record<SaveStatus, string> = {
  idle: '',
  saving: '保存中…',
  saved: '已保存到本地',
  error: '保存失败',
}
</script>

<template>
  <header class="workspace-toolbar">
    <button type="button" @click="$emit('upload')">导入教案</button>
    <button type="button" :disabled="lessonCount === 0" @click="$emit('print')">打印整册</button>
    <button type="button" :disabled="lessonCount === 0" @click="$emit('export')">导出 Markdown</button>
    <button type="button" :disabled="lessonCount === 0" @click="$emit('clear')">清空</button>

    <span class="workspace-toolbar-count">共 {{ lessonCount }} 课</span>
    <span v-if="warningCount > 0" class="workspace-toolbar-warning">
      {{ warningCount }} 处提示
    </span>
    <span class="workspace-toolbar-status" :class="`workspace-toolbar-status--${saveStatus}`">
      {{ saveStatusLabel[props.saveStatus] }}
    </span>
  </header>
</template>
