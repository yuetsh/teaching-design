<script setup lang="ts">
import ToolbarMenuButton from './ToolbarMenuButton.vue'

const emit = defineEmits<{
  generate: []
  batchGenerate: []
}>()
</script>

<template>
  <ToolbarMenuButton label="生成教案 ▾" toggle-testid="generate-menu-toggle">
    <template #default="{ close }">
      <li role="menuitem">
        <button
          type="button"
          data-testid="batch-generate"
          @click="
            emit('batchGenerate');
            close()
          "
        >
          批量生成
        </button>
      </li>
      <li role="menuitem">
        <button
          type="button"
          data-testid="generate"
          @click="
            emit('generate');
            close()
          "
        >
          生成一篇
        </button>
      </li>
    </template>
  </ToolbarMenuButton>
</template>
