<script setup lang="ts">
import ToolbarMenuButton from './ToolbarMenuButton.vue'

defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{
  print: []
  export: []
}>()
</script>

<template>
  <ToolbarMenuButton label="导出 ▾" toggle-testid="export-menu-toggle" :disabled="disabled">
    <template #default="{ close }">
      <li role="menuitem">
        <button
          type="button"
          data-testid="print"
          @click="
            emit('print');
            close()
          "
        >
          打印整册
        </button>
      </li>
      <li role="menuitem">
        <button
          type="button"
          data-testid="export"
          @click="
            emit('export');
            close()
          "
        >
          导出 MD
        </button>
      </li>
    </template>
  </ToolbarMenuButton>
</template>
