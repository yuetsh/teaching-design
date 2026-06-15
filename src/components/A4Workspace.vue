<script setup lang="ts">
import type { BookCover, TeachingDesign } from '../domain/teachingDesign'
import CoverPage from './CoverPage.vue'
import TeachingDesignPage from './TeachingDesignPage.vue'

defineProps<{
  cover: BookCover
  selectedId: string
  selectedDesign: TeachingDesign | null
}>()

const emit = defineEmits<{
  'update:cover': [patch: Partial<BookCover>]
  'update:design': [design: TeachingDesign]
}>()
</script>

<template>
  <div class="a4-workspace">
    <div class="a4-paper">
      <CoverPage
        v-if="selectedId === 'cover'"
        :course-name="cover.courseName"
        :teacher-name="cover.teacherName"
        :editable="true"
        @update:course-name="emit('update:cover', { courseName: $event })"
        @update:teacher-name="emit('update:cover', { teacherName: $event })"
      />
      <TeachingDesignPage
        v-else-if="selectedDesign"
        :design="selectedDesign"
        :editable="true"
        @update:design="emit('update:design', $event)"
      />
    </div>
  </div>
</template>
