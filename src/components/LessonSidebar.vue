<script setup lang="ts">
import { ref } from 'vue'
import type { DesignId, TeachingDesign } from '../domain/teachingDesign'

defineProps<{
  designs: TeachingDesign[]
  selectedId: 'cover' | DesignId
}>()

const emit = defineEmits<{
  select: [id: 'cover' | DesignId]
  remove: [id: DesignId]
  move: [from: number, to: number]
}>()

const dragSourceIndex = ref<number | null>(null)

function onDragStart(index: number): void {
  dragSourceIndex.value = index
}

function onDrop(targetIndex: number): void {
  if (dragSourceIndex.value !== null && dragSourceIndex.value !== targetIndex) {
    emit('move', dragSourceIndex.value, targetIndex)
  }
  dragSourceIndex.value = null
}
</script>

<template>
  <nav class="lesson-sidebar" aria-label="教案目录">
    <button
      type="button"
      class="lesson-sidebar-item lesson-sidebar-cover"
      :class="{ 'lesson-sidebar-item--active': selectedId === 'cover' }"
      @click="emit('select', 'cover')"
    >
      封面
    </button>

    <ul class="lesson-sidebar-list">
      <li
        v-for="(design, index) in designs"
        :key="design.id"
        class="lesson-sidebar-item"
        :class="{ 'lesson-sidebar-item--active': selectedId === design.id }"
        :data-index="index"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop="onDrop(index)"
      >
        <button
          type="button"
          class="lesson-sidebar-select"
          @click="emit('select', design.id)"
        >
          <span class="lesson-sidebar-number">{{ index + 1 }}</span>
          <span class="lesson-sidebar-topic">{{ design.topic || design.originalFilename }}</span>
          <span v-if="design.warnings.length" class="lesson-sidebar-badge">
            {{ design.warnings.length }}
          </span>
        </button>
        <button
          type="button"
          class="lesson-sidebar-remove"
          aria-label="删除教案"
          @click="emit('remove', design.id)"
        >
          ×
        </button>
      </li>
    </ul>
  </nav>
</template>
