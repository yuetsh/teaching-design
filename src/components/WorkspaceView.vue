<script setup lang="ts">
import { ref } from 'vue'
import { type DuplicateStrategy, useTeachingBook } from '../composables/useTeachingBook'
import type { TeachingDesign } from '../domain/teachingDesign'
import { createBookZip, downloadBlob } from '../services/zipExporter'
import A4Workspace from './A4Workspace.vue'
import BatchGenerateDialog from './BatchGenerateDialog.vue'
import FixBrokenDialog from './FixBrokenDialog.vue'
import GenerateLessonDialog from './GenerateLessonDialog.vue'
import ImportConflictDialog from './ImportConflictDialog.vue'
import LessonSidebar from './LessonSidebar.vue'
import PrintBook from './PrintBook.vue'
import UploadDropzone from './UploadDropzone.vue'
import WorkspaceToolbar from './WorkspaceToolbar.vue'

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
  importFiles,
  detectDuplicates,
  selectPage,
  moveDesign,
  removeDesign,
  updateDesign,
  clearBook,
  generateLesson,
  regenerateLesson,
} = useTeachingBook(props.bookId)

const pendingFiles = ref<File[]>([])
const duplicateNames = ref<string[]>([])
const errorMessage = ref<string | null>(null)
const uploadRef = ref<InstanceType<typeof UploadDropzone> | null>(null)

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

async function runImport(files: File[], strategy: DuplicateStrategy): Promise<void> {
  const result = await importFiles(files, strategy)
  if (result.failed.length > 0) {
    errorMessage.value = `${result.failed.length} 个文件导入失败：${result.failed
      .map((entry) => `${entry.filename}（${entry.message}）`)
      .join('、')}`
  }
}

async function handleFiles(files: File[]): Promise<void> {
  const duplicates = detectDuplicates(files)
  if (duplicates.length > 0) {
    pendingFiles.value = files
    duplicateNames.value = duplicates
    return
  }
  await runImport(files, 'keep')
}

async function resolveConflict(strategy: DuplicateStrategy | 'cancel'): Promise<void> {
  const files = pendingFiles.value
  pendingFiles.value = []
  duplicateNames.value = []
  if (strategy === 'cancel') return
  await runImport(files, strategy)
}

function triggerUpload(): void {
  uploadRef.value?.openPicker()
}

function handlePrint(): void {
  const prev = document.title
  document.title = bookName.value || prev
  window.print()
  document.title = prev
}

async function handleExport(): Promise<void> {
  try {
    const blob = await createBookZip(book.value.designs)
    downloadBlob(blob, 'teaching-design-book.zip')
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

  for (const topic of topics) {
    if (batchCancelled.value) break
    batchCurrentTopic.value = topic
    const result = await generateLesson(topic)
    if (!result.ok) {
      batchError.value = result.message
      break
    }
    batchDone.value++
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
      <ImportConflictDialog
        v-if="duplicateNames.length > 0"
        :duplicates="duplicateNames"
        @replace="resolveConflict('replace')"
        @keep="resolveConflict('keep')"
        @cancel="resolveConflict('cancel')"
      />
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
        @upload="triggerUpload"
        @generate="openGenerateDialog"
        @batch-generate="showBatchDialog = true"
        @fix-broken="openFixDialog"
        @print="handlePrint"
        @export="handleExport"
        @clear="handleClear"
      />

      <UploadDropzone v-if="!hasDesigns" @files="handleFiles" />

      <template v-else>
        <div class="workspace-layout">
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
        <UploadDropzone ref="uploadRef" compact class="visually-hidden" @files="handleFiles" />
      </template>

      <PrintBook :designs="book.designs" />
    </template>
  </div>
</template>
