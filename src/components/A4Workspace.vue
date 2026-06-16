<script setup lang="ts">
import type { TeachingDesign } from '../domain/teachingDesign'
import TeachingDesignPage from './TeachingDesignPage.vue'

defineProps<{
  selectedDesign: TeachingDesign | null
}>()

const emit = defineEmits<{
  'update:design': [design: TeachingDesign]
}>()
</script>

<template>
  <div class="a4-workspace">
    <div class="a4-paper">
      <TeachingDesignPage
        v-if="selectedDesign"
        :design="selectedDesign"
        :editable="true"
        @update:design="emit('update:design', $event)"
      />
    </div>
  </div>
</template>
