<script setup lang="ts">
defineProps<{
  duplicates: string[]
}>()

defineEmits<{
  replace: []
  keep: []
  cancel: []
}>()
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="import-conflict-title">
    <div class="dialog">
      <h2 id="import-conflict-title">发现重名教案</h2>
      <p>以下文件名与当前书本中的教案重复：</p>
      <ul class="dialog-filenames">
        <li v-for="filename in duplicates" :key="filename">{{ filename }}</li>
      </ul>
      <p>「替换」会用新文件覆盖原位置上的教案；「保留两者」会将新文件作为新的一课追加导入。</p>
      <div class="dialog-actions">
        <button type="button" @click="$emit('replace')">替换</button>
        <button type="button" @click="$emit('keep')">保留两者</button>
        <button type="button" @click="$emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>
