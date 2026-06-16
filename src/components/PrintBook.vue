<script setup lang="ts">
import type { TeachingDesign } from '../../shared/domain/teachingDesign'
import TeachingDesignPage from './TeachingDesignPage.vue'

defineProps<{
  designs: TeachingDesign[]
}>()
</script>

<template>
  <div class="print-book">
    <div v-for="design in designs" :key="design.id" class="print-section">
      <TeachingDesignPage :design="design" :editable="false" />
    </div>
  </div>
</template>
