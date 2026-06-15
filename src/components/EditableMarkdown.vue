<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { renderMarkdown } from '../services/markdownRenderer'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    editable?: boolean
  }>(),
  { editable: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editing = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function resize(): void {
  const element = textareaRef.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function activate(): void {
  if (!props.editable) return
  editing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
    resize()
  })
}

function deactivate(): void {
  editing.value = false
}

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resize()
}

watch(
  () => props.modelValue,
  () => {
    if (editing.value) nextTick(resize)
  },
)
</script>

<template>
  <div class="editable-field editable-markdown">
    <div
      v-if="!editing"
      class="markdown-preview"
      :class="{ 'markdown-preview--empty': !modelValue }"
      :tabindex="editable ? 0 : undefined"
      :role="editable ? 'button' : undefined"
      :aria-label="label"
      @click="activate"
      @keydown.enter.prevent="activate"
      @keydown.space.prevent="activate"
      v-html="modelValue ? renderMarkdown(modelValue) : '&nbsp;'"
    ></div>
    <textarea
      v-else
      ref="textareaRef"
      class="markdown-source"
      :aria-label="label"
      :value="modelValue"
      rows="1"
      @input="onInput"
      @blur="deactivate"
    ></textarea>
  </div>
</template>
