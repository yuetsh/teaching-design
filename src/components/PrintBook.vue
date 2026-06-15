<script setup lang="ts">
import type { BookCover, TeachingDesign } from '../domain/teachingDesign'
import CoverPage from './CoverPage.vue'
import TeachingDesignPage from './TeachingDesignPage.vue'

defineProps<{
  cover: BookCover
  designs: TeachingDesign[]
}>()
</script>

<template>
  <div class="print-book">
    <div class="print-section">
      <CoverPage
        :course-name="cover.courseName"
        :teacher-name="cover.teacherName"
        :editable="false"
      />
    </div>
    <div v-for="design in designs" :key="design.id" class="print-section">
      <TeachingDesignPage :design="design" :editable="false" />
    </div>
  </div>
</template>
