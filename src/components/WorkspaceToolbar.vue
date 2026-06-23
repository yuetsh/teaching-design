<script setup lang="ts">
import type { SaveStatus } from '../composables/useTeachingBook'
import GenerateMenuButton from './GenerateMenuButton.vue'

const props = defineProps<{
  lessonCount: number
  warningCount: number
  saveStatus: SaveStatus
}>()

defineEmits<{
  print: []
  export: []
  clear: []
  generate: []
  batchGenerate: []
  fixBroken: []
  back: []
}>()

const saveStatusLabel: Record<SaveStatus, string> = {
  idle: '',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}
</script>

<template>
  <header class="workspace-toolbar">
    <button type="button" data-testid="back" @click="$emit('back')">返回列表</button>
    <GenerateMenuButton @generate="$emit('generate')" @batch-generate="$emit('batchGenerate')" />
    <button type="button" data-testid="print" :disabled="lessonCount === 0" @click="$emit('print')">打印整册</button>
    <button type="button" data-testid="export" :disabled="lessonCount === 0" @click="$emit('export')">导出 MD</button>
    <button type="button" data-testid="clear" :disabled="lessonCount === 0" @click="$emit('clear')">清空</button>

    <span class="workspace-toolbar-count">共 {{ lessonCount }} 课</span>
    <template v-if="warningCount > 0">
      <button type="button" data-testid="fix-broken" @click="$emit('fixBroken')">
        修复 {{ warningCount }} 处提示
      </button>
    </template>
    <span class="workspace-toolbar-status" :class="`workspace-toolbar-status--${saveStatus}`">
      {{ saveStatusLabel[props.saveStatus] }}
    </span>
  </header>
</template>
