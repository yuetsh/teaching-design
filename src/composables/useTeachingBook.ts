import { ref, watch, type Ref } from 'vue'
import {
  createEmptyBook,
  type BookCover,
  type DesignId,
  type TeachingBook,
  type TeachingDesign,
} from '../domain/teachingDesign'
import { saveBook } from '../services/bookStorage'
import { parseTeachingDesign } from '../services/markdownParser'
import { sortFilesNaturally } from '../services/naturalSort'

const AUTOSAVE_DELAY_MS = 300

export type DuplicateStrategy = 'replace' | 'keep'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface ImportResult {
  imported: number
  failed: Array<{ filename: string; message: string }>
  duplicates: string[]
}

export interface TeachingBookStore {
  book: Ref<TeachingBook>
  saveStatus: Ref<SaveStatus>
  lastError: Ref<string | null>
  pendingDuplicateFiles: Ref<File[]>
  selectedDesign: Ref<TeachingDesign | null>
  hasDesigns: Ref<boolean>
  warningCount: Ref<number>
  importFiles: (files: readonly File[], strategy: DuplicateStrategy) => Promise<ImportResult>
  detectDuplicates: (files: readonly File[]) => string[]
  selectPage: (id: 'cover' | DesignId) => void
  moveDesign: (from: number, to: number) => void
  removeDesign: (id: DesignId) => void
  updateCover: (patch: Partial<BookCover>) => void
  updateDesign: (id: DesignId, updater: (design: TeachingDesign) => void) => void
  restore: (book: TeachingBook) => void
  clearBook: () => void
}

export function useTeachingBook(): TeachingBookStore {
  const book = ref<TeachingBook>(createEmptyBook()) as Ref<TeachingBook>
  const saveStatus = ref<SaveStatus>('idle')
  const lastError = ref<string | null>(null)
  const pendingDuplicateFiles = ref<File[]>([])

  const selectedDesign = ref<TeachingDesign | null>(null)
  const hasDesigns = ref(false)
  const warningCount = ref(0)

  function syncDerived(): void {
    const current = book.value
    hasDesigns.value = current.designs.length > 0
    selectedDesign.value =
      current.selectedId === 'cover'
        ? null
        : current.designs.find((design) => design.id === current.selectedId) ?? null
    warningCount.value = current.designs.reduce(
      (total, design) => total + design.warnings.length,
      0,
    )
  }

  syncDerived()

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined

  function touch(): void {
    book.value.updatedAt = new Date().toISOString()
  }

  watch(
    book,
    () => {
      syncDerived()

      if (autosaveTimer !== undefined) {
        clearTimeout(autosaveTimer)
      }

      autosaveTimer = setTimeout(() => {
        saveStatus.value = 'saving'
        const result = saveBook(book.value)
        if (result.ok) {
          saveStatus.value = 'saved'
          lastError.value = null
        } else {
          saveStatus.value = 'error'
          lastError.value = result.message
        }
      }, AUTOSAVE_DELAY_MS)
    },
    { deep: true },
  )

  function detectDuplicates(files: readonly File[]): string[] {
    const existingNames = new Set(book.value.designs.map((design) => design.originalFilename))
    return files.map((file) => file.name).filter((name) => existingNames.has(name))
  }

  async function importFiles(
    files: readonly File[],
    strategy: DuplicateStrategy,
  ): Promise<ImportResult> {
    const markdownFiles = files.filter((file) => /\.md$/i.test(file.name))
    const failed: ImportResult['failed'] = files
      .filter((file) => !/\.md$/i.test(file.name))
      .map((file) => ({ filename: file.name, message: '仅支持 .md 文件。' }))

    const sortedFiles = sortFilesNaturally([...markdownFiles])
    const duplicates: string[] = []
    let imported = 0

    for (const file of sortedFiles) {
      try {
        const text = await file.text()
        const design = parseTeachingDesign(file.name, text)

        const existingIndex = book.value.designs.findIndex(
          (existing) => existing.originalFilename === file.name,
        )

        if (existingIndex !== -1) {
          duplicates.push(file.name)
          if (strategy === 'replace') {
            book.value.designs.splice(existingIndex, 1, design)
          } else {
            book.value.designs.push(design)
          }
        } else {
          book.value.designs.push(design)
        }

        imported++
      } catch (error) {
        failed.push({
          filename: file.name,
          message: error instanceof Error ? error.message : '解析失败。',
        })
      }
    }

    if (imported > 0 && book.value.selectedId === 'cover' && book.value.designs.length > 0) {
      book.value.selectedId = book.value.designs[0]!.id
    }

    if (imported > 0) {
      touch()
    }

    return { imported, failed, duplicates }
  }

  function selectPage(id: 'cover' | DesignId): void {
    book.value.selectedId = id
  }

  function moveDesign(from: number, to: number): void {
    const designs = book.value.designs
    if (from < 0 || from >= designs.length || to < 0 || to >= designs.length) {
      return
    }
    const [moved] = designs.splice(from, 1)
    designs.splice(to, 0, moved!)
    touch()
  }

  function removeDesign(id: DesignId): void {
    const designs = book.value.designs
    const index = designs.findIndex((design) => design.id === id)
    if (index === -1) {
      return
    }
    designs.splice(index, 1)

    if (book.value.selectedId === id) {
      book.value.selectedId = designs[index]?.id ?? designs[index - 1]?.id ?? 'cover'
    }

    touch()
  }

  function updateCover(patch: Partial<BookCover>): void {
    Object.assign(book.value.cover, patch)
    touch()
  }

  function updateDesign(id: DesignId, updater: (design: TeachingDesign) => void): void {
    const design = book.value.designs.find((candidate) => candidate.id === id)
    if (!design) {
      return
    }
    updater(design)
    touch()
  }

  function restore(restored: TeachingBook): void {
    book.value = restored
  }

  function clearBook(): void {
    book.value = createEmptyBook()
  }

  return {
    book,
    saveStatus,
    lastError,
    pendingDuplicateFiles,
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
  }
}
