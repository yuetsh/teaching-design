<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false,
})

const emit = defineEmits<{ files: [files: File[]] }>()

const inputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)

function openPicker(): void {
  inputRef.value?.click()
}

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files) {
    emit('files', Array.from(input.files))
  }
  input.value = ''
}

function onDrop(event: DragEvent): void {
  isDragOver.value = false
  const files = event.dataTransfer?.files
  if (files) {
    emit('files', Array.from(files))
  }
}

function onDragOver(): void {
  isDragOver.value = true
}

function onDragLeave(): void {
  isDragOver.value = false
}

defineExpose({ openPicker })
</script>

<template>
  <div
    class="upload-dropzone"
    :class="{
      'upload-dropzone--compact': compact,
      'upload-dropzone--drag-over': isDragOver,
    }"
    role="button"
    tabindex="0"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <input
      ref="inputRef"
      type="file"
      multiple
      accept=".md,text/markdown,text/plain"
      class="upload-dropzone-input"
      @change="onChange"
      @click.stop
    />
    <template v-if="compact">
      <span class="upload-dropzone-label">导入教学设计</span>
    </template>
    <template v-else>
      <p class="upload-dropzone-title">点击或拖拽上传 Markdown 教学设计文件</p>
      <p class="upload-dropzone-hint">支持批量导入多个 .md 文件</p>
    </template>
  </div>
</template>
