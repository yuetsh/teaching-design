<script setup lang="ts">
import { ref } from 'vue'
import { type DuplicateStrategy, useTeachingBook } from '../composables/useTeachingBook'
import type { TeachingDesign } from '../domain/teachingDesign'
import { createBookZip, downloadBlob } from '../services/zipExporter'
import A4Workspace from './A4Workspace.vue'
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
  updateCover,
  updateDesign,
  clearBook,
  generateLesson,
} = useTeachingBook(props.bookId)

const pendingFiles = ref<File[]>([])
const duplicateNames = ref<string[]>([])
const errorMessage = ref<string | null>(null)
const uploadRef = ref<InstanceType<typeof UploadDropzone> | null>(null)

const showGenerateDialog = ref(false)
const generateLoading = ref(false)
const generateError = ref<string | null>(null)

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
  window.print()
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
            :cover="book.cover"
            :selected-id="book.selectedId"
            :selected-design="selectedDesign"
            @update:cover="updateCover"
            @update:design="handleDesignUpdate"
          />
        </div>
        <UploadDropzone ref="uploadRef" compact class="visually-hidden" @files="handleFiles" />
      </template>

      <PrintBook :cover="book.cover" :designs="book.designs" />
    </template>
  </div>
</template>
