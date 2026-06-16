<script setup lang="ts">
import { ref } from 'vue'
import { useTeachingBook } from '../composables/useTeachingBook'
import type { TeachingDesign } from '../../shared/domain/teachingDesign'
import { createBookZip, downloadBlob } from '../services/zipExporter'
import A4Workspace from './A4Workspace.vue'
import BatchGenerateDialog from './BatchGenerateDialog.vue'
import FixBrokenDialog from './FixBrokenDialog.vue'
import GenerateLessonDialog from './GenerateLessonDialog.vue'
import LessonSidebar from './LessonSidebar.vue'
import PrintBook from './PrintBook.vue'
import WorkspaceToolbar from './WorkspaceToolbar.vue'

const BATCH_GENERATE_CONCURRENCY = 3
const DEFAULT_EXPORT_ZIP_NAME = 'teaching-design-book'

const props = defineProps<{ bookId: string }>()

defineEmits<{ back: [] }>()

const {
  book,
  bookName,
  loadStatus,
  loadError,
  saveStatus,
  lastError,
  selectedDesign,
  hasDesigns,
  warningCount,
  selectPage,
  moveDesign,
  removeDesign,
  updateDesign,
  clearBook,
  generateLesson,
  generateLessons,
  regenerateLesson,
} = useTeachingBook(props.bookId)

const errorMessage = ref<string | null>(null)

const showGenerateDialog = ref(false)
const generateLoading = ref(false)
const generateError = ref<string | null>(null)

const showBatchDialog = ref(false)
const batchRunning = ref(false)
const batchDone = ref(0)
const batchTotal = ref(0)
const batchCurrentTopic = ref('')
const batchError = ref<string | null>(null)
const batchCancelled = ref(false)

const showFixDialog = ref(false)
const fixRunning = ref(false)
const fixDone = ref(0)
const fixTotal = ref(0)
const fixCurrentTopic = ref('')
const fixError = ref<string | null>(null)
const fixCancelled = ref(false)

function handlePrint(): void {
  const prev = document.title
  document.title = bookName.value || prev
  window.print()
  document.title = prev
}

function createExportZipFilename(name: string): string {
  const stem = name.trim().replace(/[\\/:*?"<>|]/g, '_')
  return `${stem || DEFAULT_EXPORT_ZIP_NAME}.zip`
}

async function handleExport(): Promise<void> {
  try {
    const blob = await createBookZip(book.value.designs)
    downloadBlob(blob, createExportZipFilename(bookName.value))
  } catch {
    errorMessage.value = '导出失败，请重试。'
  }
}

function handleClear(): void {
  if (book.value.designs.length === 0) {
    return
  }
  if (window.confirm('确定要清空当前所有教案吗？此操作无法撤销。')) {
    clearBook()
  }
}

function handleDesignUpdate(design: TeachingDesign): void {
  updateDesign(design.id, (target) => Object.assign(target, design))
}

function openGenerateDialog(): void {
  generateError.value = null
  showGenerateDialog.value = true
}

async function handleGenerateSubmit(topic: string): Promise<void> {
  generateLoading.value = true
  generateError.value = null
  const result = await generateLesson(topic)
  generateLoading.value = false

  if (result.ok) {
    showGenerateDialog.value = false
  } else {
    generateError.value = result.message
  }
}

function cancelGenerate(): void {
  showGenerateDialog.value = false
  generateError.value = null
}

async function handleBatchStart(topics: string[]): Promise<void> {
  batchRunning.value = true
  batchCancelled.value = false
  batchDone.value = 0
  batchTotal.value = topics.length
  batchError.value = null

  const result = await generateLessons(topics, {
    concurrency: BATCH_GENERATE_CONCURRENCY,
    isCancelled: () => batchCancelled.value,
    onTopicStart: (topic) => {
      batchCurrentTopic.value = topic
    },
    onLessonComplete: (count) => {
      batchDone.value += count
    },
  })

  if (!result.ok) {
    batchError.value = result.message
  }

  batchRunning.value = false
}

function handleBatchCancel(): void {
  batchCancelled.value = true
}

function closeBatchDialog(): void {
  showBatchDialog.value = false
  batchDone.value = 0
  batchTotal.value = 0
  batchError.value = null
}

function openFixDialog(): void {
  fixTotal.value = book.value.designs.filter((d) => d.warnings.length > 0).length
  fixDone.value = 0
  fixError.value = null
  showFixDialog.value = true
}

async function handleFixStart(): Promise<void> {
  const broken = book.value.designs.filter((d) => d.warnings.length > 0)
  fixCancelled.value = false
  fixRunning.value = true

  for (const lesson of broken) {
    if (fixCancelled.value) break
    fixCurrentTopic.value = lesson.originalFilename.replace(/\.md$/i, '')
    const result = await regenerateLesson(lesson.id)
    if (!result.ok) {
      fixError.value = result.message
      break
    }
    fixDone.value++
  }

  fixRunning.value = false
}

function handleFixCancel(): void {
  fixCancelled.value = true
}

function closeFixDialog(): void {
  showFixDialog.value = false
  fixDone.value = 0
  fixTotal.value = 0
  fixError.value = null
}
</script>

<template>
  <div class="app-shell">
    <p v-if="loadStatus === 'loading'">加载中…</p>

    <div v-else-if="loadStatus === 'error'" class="app-notice app-notice--error" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" @click="$emit('back')">返回列表</button>
    </div>

    <template v-else>
      <GenerateLessonDialog
        v-if="showGenerateDialog"
        :loading="generateLoading"
        :error="generateError"
        @submit="handleGenerateSubmit"
        @cancel="cancelGenerate"
      />
      <BatchGenerateDialog
        v-if="showBatchDialog"
        :running="batchRunning"
        :done="batchDone"
        :total="batchTotal"
        :current-topic="batchCurrentTopic"
        :error="batchError"
        :default-theme="bookName"
        @start="handleBatchStart"
        @cancel="handleBatchCancel"
        @close="closeBatchDialog"
      />
      <FixBrokenDialog
        v-if="showFixDialog"
        :running="fixRunning"
        :done="fixDone"
        :total="fixTotal"
        :current-topic="fixCurrentTopic"
        :error="fixError"
        @start="handleFixStart"
        @cancel="handleFixCancel"
        @close="closeFixDialog"
      />

      <p v-if="errorMessage" class="app-notice app-notice--error" role="alert">
        {{ errorMessage }}
        <button type="button" @click="errorMessage = null">关闭</button>
      </p>
      <p v-if="saveStatus === 'error' && lastError" class="app-notice app-notice--error" role="alert">
        {{ lastError }}
      </p>

      <WorkspaceToolbar
        :lesson-count="book.designs.length"
        :warning-count="warningCount"
        :save-status="saveStatus"
        @back="$emit('back')"
        @generate="openGenerateDialog"
        @batch-generate="showBatchDialog = true"
        @fix-broken="openFixDialog"
        @print="handlePrint"
        @export="handleExport"
        @clear="handleClear"
      />

      <div v-if="hasDesigns" class="workspace-layout">
        <LessonSidebar
          :designs="book.designs"
          :selected-id="book.selectedId"
          @select="selectPage"
          @remove="removeDesign"
          @move="moveDesign"
        />
        <A4Workspace
          :selected-design="selectedDesign"
          @update:design="handleDesignUpdate"
        />
      </div>

      <PrintBook :designs="book.designs" />
    </template>
  </div>
</template>
