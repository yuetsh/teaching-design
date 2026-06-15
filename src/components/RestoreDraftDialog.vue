<script setup lang="ts">
defineProps<{
  updatedAt: string
}>()

defineEmits<{
  restore: []
  discard: []
}>()
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="restore-draft-title">
    <div class="dialog">
      <h2 id="restore-draft-title">发现未保存的草稿</h2>
      <p>检测到本地保存的教案，最近更新时间：{{ updatedAt }}</p>
      <p>是否恢复上次编辑的内容？</p>
      <div class="dialog-actions">
        <button type="button" @click="$emit('restore')">恢复</button>
        <button type="button" @click="$emit('discard')">放弃</button>
      </div>
    </div>
  </div>
</template>
