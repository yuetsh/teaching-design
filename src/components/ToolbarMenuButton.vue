<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{
  label: string
  toggleTestid: string
  disabled?: boolean
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
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
  <div ref="rootRef" class="toolbar-menu" @keydown="handleKeydown">
    <button
      type="button"
      :data-testid="toggleTestid"
      :disabled="disabled"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ label }}
    </button>
    <ul v-if="open" class="toolbar-menu-list" role="menu">
      <slot :close="close" />
    </ul>
  </div>
</template>
