<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  generate: []
  batchGenerate: []
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function select(action: 'generate' | 'batchGenerate'): void {
  emit(action)
  close()
}

function handleDocumentClick(event: MouseEvent): void {
  if (!rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div ref="rootRef" class="generate-menu" @keydown="handleKeydown">
    <button
      type="button"
      data-testid="generate-menu-toggle"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      生成教案 ▾
    </button>
    <ul v-if="open" class="generate-menu-list" role="menu">
      <li role="menuitem">
        <button type="button" data-testid="generate" @click="select('generate')">生成一篇</button>
      </li>
      <li role="menuitem">
        <button type="button" data-testid="batch-generate" @click="select('batchGenerate')">
          批量生成
        </button>
      </li>
    </ul>
  </div>
</template>
