<script setup lang="ts">
import { onMounted, ref } from 'vue'
import A4Workspace from './components/A4Workspace.vue'
import ImportConflictDialog from './components/ImportConflictDialog.vue'
import LessonSidebar from './components/LessonSidebar.vue'
import PrintBook from './components/PrintBook.vue'
import RestoreDraftDialog from './components/RestoreDraftDialog.vue'
import UploadDropzone from './components/UploadDropzone.vue'
import WorkspaceToolbar from './components/WorkspaceToolbar.vue'
import { type DuplicateStrategy, useTeachingBook } from './composables/useTeachingBook'
import { clearStoredBook, loadStoredBook } from './services/bookStorage'
import type { TeachingBook, TeachingDesign } from './domain/teachingDesign'
import { createBookZip, downloadBlob } from './services/zipExporter'

const {
  book,
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
  restore,
  clearBook,
} = useTeachingBook()

const restoreCandidate = ref<TeachingBook | null>(null)
const pendingFiles = ref<File[]>([])
const duplicateNames = ref<string[]>([])
const errorMessage = ref<string | null>(null)
const uploadRef = ref<InstanceType<typeof UploadDropzone> | null>(null)

onMounted(() => {
  const stored = loadStoredBook()
  if (stored && stored.designs.length > 0) {
    restoreCandidate.value = stored
  }
})

function restoreDraft(): void {
  if (restoreCandidate.value) {
    restore(restoreCandidate.value)
  }
  restoreCandidate.value = null
}

function discardDraft(): void {
  clearStoredBook()
  restoreCandidate.value = null
}

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
    clearStoredBook()
  }
}

function handleDesignUpdate(design: TeachingDesign): void {
  updateDesign(design.id, (target) => Object.assign(target, design))
}
</script>

<template>
  <div class="app-shell">
    <RestoreDraftDialog
      v-if="restoreCandidate"
      :updated-at="restoreCandidate.updatedAt"
      @restore="restoreDraft"
      @discard="discardDraft"
    />
    <ImportConflictDialog
      v-if="duplicateNames.length > 0"
      :duplicates="duplicateNames"
      @replace="resolveConflict('replace')"
      @keep="resolveConflict('keep')"
      @cancel="resolveConflict('cancel')"
    />

    <p v-if="errorMessage" class="app-notice app-notice--error" role="alert">
      {{ errorMessage }}
      <button type="button" @click="errorMessage = null">关闭</button>
    </p>
    <p v-if="saveStatus === 'error' && lastError" class="app-notice app-notice--error" role="alert">
      {{ lastError }}
    </p>

    <UploadDropzone v-if="!hasDesigns" @files="handleFiles" />

    <template v-else>
      <WorkspaceToolbar
        :lesson-count="book.designs.length"
        :warning-count="warningCount"
        :save-status="saveStatus"
        @upload="triggerUpload"
        @print="handlePrint"
        @export="handleExport"
        @clear="handleClear"
      />
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
  </div>
</template>
