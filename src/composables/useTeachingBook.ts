import { nextTick, ref, watch, type Ref } from 'vue'
import {
  createEmptyBook,
  type DesignId,
  type TeachingBook,
  type TeachingDesign,
} from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import { parseTeachingDesign } from '../services/markdownParser'
import { sortFilesNaturally } from '../services/naturalSort'

const AUTOSAVE_DELAY_MS = 300

export type DuplicateStrategy = 'replace' | 'keep'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type LoadStatus = 'loading' | 'loaded' | 'error'

export type GenerateLessonResult = { ok: true } | { ok: false; message: string }

export type BatchGenerateLessonResult =
  | { ok: true; completed: number }
  | { ok: false; completed: number; message: string }

export interface BatchGenerateLessonOptions {
  concurrency?: number
  isCancelled?: () => boolean
  onTopicStart?: (topic: string) => void
  onLessonComplete?: (count: number) => void
}

export interface ImportResult {
  imported: number
  failed: Array<{ filename: string; message: string }>
  duplicates: string[]
}

export interface TeachingBookStore {
  book: Ref<TeachingBook>
  bookName: Ref<string>
  loadStatus: Ref<LoadStatus>
  loadError: Ref<string | null>
  saveStatus: Ref<SaveStatus>
  lastError: Ref<string | null>
  selectedDesign: Ref<TeachingDesign | null>
  hasDesigns: Ref<boolean>
  warningCount: Ref<number>
  importFiles: (files: readonly File[], strategy: DuplicateStrategy) => Promise<ImportResult>
  detectDuplicates: (files: readonly File[]) => string[]
  selectPage: (id: DesignId) => void
  moveDesign: (from: number, to: number) => void
  removeDesign: (id: DesignId) => void
  updateDesign: (id: DesignId, updater: (design: TeachingDesign) => void) => void
  clearBook: () => void
  generateLesson: (topic: string) => Promise<GenerateLessonResult>
  generateLessons: (
    topics: readonly string[],
    options?: BatchGenerateLessonOptions,
  ) => Promise<BatchGenerateLessonResult>
  regenerateLesson: (id: DesignId) => Promise<GenerateLessonResult>
}

export function useTeachingBook(bookId: string): TeachingBookStore {
  const book = ref<TeachingBook>(createEmptyBook()) as Ref<TeachingBook>
  const bookName = ref('')
  const loadStatus = ref<LoadStatus>('loading')
  const loadError = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('idle')
  const lastError = ref<string | null>(null)

  const selectedDesign = ref<TeachingDesign | null>(null)
  const hasDesigns = ref(false)
  const warningCount = ref(0)

  let isLoading = true
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined

  function syncDerived(): void {
    const current = book.value
    hasDesigns.value = current.designs.length > 0
    selectedDesign.value =
      current.selectedId === null
        ? null
        : current.designs.find((design) => design.id === current.selectedId) ?? null
    warningCount.value = current.designs.reduce(
      (total, design) => total + design.warnings.length,
      0,
    )
  }

  syncDerived()

  function touch(): void {
    book.value.updatedAt = new Date().toISOString()
  }

  function scheduleSave(): void {
    if (autosaveTimer !== undefined) {
      clearTimeout(autosaveTimer)
    }

    autosaveTimer = setTimeout(() => {
      saveStatus.value = 'saving'
      booksApi
        .updateBook(bookId, book.value)
        .then(() => {
          saveStatus.value = 'saved'
          lastError.value = null
        })
        .catch((error: unknown) => {
          saveStatus.value = 'error'
          lastError.value = error instanceof Error ? error.message : '保存失败。'
        })
    }, AUTOSAVE_DELAY_MS)
  }

  watch(
    book,
    () => {
      syncDerived()
      if (isLoading) return
      scheduleSave()
    },
    { deep: true },
  )

  async function load(): Promise<void> {
    try {
      const record = await booksApi.getBook(bookId)
      book.value = record.data
      bookName.value = record.name
      await nextTick()
      loadStatus.value = 'loaded'
    } catch (error) {
      loadStatus.value = 'error'
      loadError.value = error instanceof Error ? error.message : '加载失败。'
    } finally {
      isLoading = false
    }
  }

  void load()

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

    if (imported > 0 && book.value.selectedId === null && book.value.designs.length > 0) {
      book.value.selectedId = book.value.designs[0]!.id
    }

    if (imported > 0) {
      touch()
    }

    return { imported, failed, duplicates }
  }

  function selectPage(id: DesignId): void {
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
      book.value.selectedId = designs[index]?.id ?? designs[index - 1]?.id ?? null
    }

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

  function clearBook(): void {
    book.value.designs = []
    book.value.selectedId = null
    touch()
  }

  async function generateLesson(topic: string): Promise<GenerateLessonResult> {
    try {
      const result = await booksApi.generateLesson(topic)
      const design = parseTeachingDesign(result.filename, result.markdown)
      book.value.designs.push(design)
      book.value.selectedId = design.id
      touch()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '生成失败。' }
    }
  }

  async function generateLessons(
    topics: readonly string[],
    options: BatchGenerateLessonOptions = {},
  ): Promise<BatchGenerateLessonResult> {
    const concurrency = Math.max(1, options.concurrency ?? 3)
    const workerCount = Math.min(concurrency, topics.length)
    const results = new Array<TeachingDesign | undefined>(topics.length)
    let nextStartIndex = 0
    let nextAppendIndex = 0
    let appendedCount = 0
    let firstError: string | null = null

    function appendReadyLessons(): void {
      let readyCount = 0

      while (nextAppendIndex < results.length) {
        const design = results[nextAppendIndex]
        if (!design) break
        book.value.designs.push(design)
        book.value.selectedId = design.id
        nextAppendIndex++
        readyCount++
      }

      if (readyCount > 0) {
        appendedCount += readyCount
        touch()
        options.onLessonComplete?.(readyCount)
      }
    }

    async function runWorker(): Promise<void> {
      while (!firstError && !options.isCancelled?.()) {
        const index = nextStartIndex
        if (index >= topics.length) return

        nextStartIndex++
        const topic = topics[index]!
        options.onTopicStart?.(topic)

        try {
          const result = await booksApi.generateLesson(topic)
          results[index] = parseTeachingDesign(result.filename, result.markdown)
          appendReadyLessons()
        } catch (error) {
          firstError = error instanceof Error ? error.message : '生成失败。'
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
    appendReadyLessons()

    return firstError
      ? { ok: false, completed: appendedCount, message: firstError }
      : { ok: true, completed: appendedCount }
  }

  async function regenerateLesson(id: DesignId): Promise<GenerateLessonResult> {
    const existing = book.value.designs.find((d) => d.id === id)
    if (!existing) return { ok: false, message: '找不到该教案。' }

    const topic = existing.originalFilename.replace(/\.md$/i, '')
    try {
      const result = await booksApi.generateLesson(topic)
      const newDesign = parseTeachingDesign(result.filename, result.markdown)
      const index = book.value.designs.findIndex((d) => d.id === id)
      if (index !== -1) {
        book.value.designs.splice(index, 1, newDesign)
        if (book.value.selectedId === id) {
          book.value.selectedId = newDesign.id
        }
      }
      touch()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '修复失败。' }
    }
  }

  return {
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
    generateLessons,
    regenerateLesson,
  }
}
