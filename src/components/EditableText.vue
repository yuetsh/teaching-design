<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    multiline?: boolean
    editable?: boolean
  }>(),
  { editable: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function resize(): void {
  const element = textareaRef.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function onInput(event: Event): void {
  const value = (event.target as HTMLTextAreaElement).value
  emit('update:modelValue', value)
  resize()
}

watch(
  () => props.modelValue,
  () => nextTick(resize),
)

onMounted(resize)
</script>

<template>
  <textarea
    v-if="editable"
    ref="textareaRef"
    class="editable-field editable-text"
    :class="{ 'editable-text--multiline': multiline }"
    :aria-label="label"
    :value="modelValue"
    rows="1"
    @input="onInput"
  ></textarea>
  <span
    v-else
    class="editable-field editable-text editable-text--static"
    :class="{ 'editable-text--multiline': multiline }"
    :aria-label="label"
    >{{ modelValue }}</span
  >
</template>
