<script setup lang="ts">
import EditableText from './EditableText.vue'

defineProps<{
  courseName: string
  teacherName: string
  editable: boolean
}>()

defineEmits<{
  'update:courseName': [value: string]
  'update:teacherName': [value: string]
}>()
</script>

<template>
  <section class="page cover-page">
    <h1 class="cover-title">教学设计</h1>
    <div class="cover-field">
      <span class="cover-field-label">课程名称</span>
      <EditableText
        class="cover-field-value"
        :model-value="courseName"
        label="课程名称"
        :editable="editable"
        @update:model-value="$emit('update:courseName', $event)"
      />
    </div>
    <div class="cover-field">
      <span class="cover-field-label">教师姓名</span>
      <EditableText
        class="cover-field-value"
        :model-value="teacherName"
        label="教师姓名"
        :editable="editable"
        @update:model-value="$emit('update:teacherName', $event)"
      />
    </div>
  </section>
</template>
