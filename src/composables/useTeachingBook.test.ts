import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook, createEmptyTeachingDesign, type TeachingBook } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import { useTeachingBook } from './useTeachingBook'

vi.mock('../services/booksApi')

function mockGetBook(data: TeachingBook, id = 'b1'): void {
  vi.mocked(booksApi.getBook).mockResolvedValue({ id, name: '示例整本', updatedAt: data.updatedAt, data })
}

describe('useTeachingBook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('loads the book from the API', async () => {
    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    expect(booksApi.getBook).toHaveBeenCalledWith('b1')
    expect(store.loadStatus.value).toBe('loaded')
    expect(store.book.value.cover.courseName).toBe('Web 前端开发')
  })

  it('sets loadStatus to error when loading fails', async () => {
    vi.mocked(booksApi.getBook).mockRejectedValue(new Error('网络错误。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    expect(store.loadStatus.value).toBe('error')
    expect(store.loadError.value).toBe('网络错误。')
  })

  it('imports files in natural order and selects the first lesson', async () => {
    mockGetBook(createEmptyBook())
    const store = useTeachingBook('b1')
    await flushPromises()

    const files = [
      new File(['# 第十课 教学设计'], '10.md', { type: 'text/markdown' }),
      new File(['# 第二课 教学设计'], '2.md', { type: 'text/markdown' }),
    ]

    await store.importFiles(files, 'keep')

    expect(store.book.value.designs.map((design) => design.originalFilename)).toEqual(['2.md', '10.md'])
    expect(store.book.value.selectedId).toBe(store.book.value.designs[0]?.id)
  })

  it('reorders lessons without changing their identities', async () => {
    mockGetBook(createEmptyBook())
    const store = useTeachingBook('b1')
    await flushPromises()

    await store.importFiles(
      [new File(['# One 教学设计'], '1.md'), new File(['# Two 教学设计'], '2.md')],
      'keep',
    )

    const ids = store.book.value.designs.map((design) => design.id)
    store.moveDesign(0, 1)

    expect(store.book.value.designs.map((design) => design.id)).toEqual(ids.reverse())
  })

  it('does not autosave immediately after the initial load', async () => {
    mockGetBook(createEmptyBook())
    useTeachingBook('b1')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(300)

    expect(booksApi.updateBook).not.toHaveBeenCalled()
  })

  it('autosaves the book via the API after the debounce delay', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.updateBook).mockResolvedValue({ id: 'b1', name: '示例整本', updatedAt: 'later' })

    const store = useTeachingBook('b1')
    await flushPromises()

    store.updateCover({ courseName: '新课程名' })
    await vi.advanceTimersByTimeAsync(300)

    expect(booksApi.updateBook).toHaveBeenCalledWith('b1', store.book.value)
    expect(store.saveStatus.value).toBe('saved')
  })

  it('sets saveStatus to error when autosave fails', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.updateBook).mockRejectedValue(new Error('保存失败。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    store.updateCover({ courseName: '新课程名' })
    await vi.advanceTimersByTimeAsync(300)

    expect(store.saveStatus.value).toBe('error')
    expect(store.lastError.value).toBe('保存失败。')
  })

  it('generateLesson appends a parsed design and selects it', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.generateLesson).mockResolvedValue({
      filename: 'css-flex.md',
      markdown: '# CSS 弹性布局 教学设计',
    })

    const store = useTeachingBook('b1')
    await flushPromises()

    const result = await store.generateLesson('CSS 弹性布局')

    expect(result).toEqual({ ok: true })
    expect(store.book.value.designs).toHaveLength(1)
    expect(store.book.value.selectedId).toBe(store.book.value.designs[0]?.id)
  })

  it('generateLesson returns an error when the API call fails', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.generateLesson).mockRejectedValue(new Error('Deepseek 请求失败。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    const result = await store.generateLesson('CSS 弹性布局')

    expect(result).toEqual({ ok: false, message: 'Deepseek 请求失败。' })
    expect(store.book.value.designs).toHaveLength(0)
  })

  it('clearBook empties designs but keeps the cover', async () => {
    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'
    data.designs.push(createEmptyTeachingDesign('1.md'))
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    store.clearBook()

    expect(store.book.value.designs).toEqual([])
    expect(store.book.value.cover.courseName).toBe('Web 前端开发')
    expect(store.book.value.selectedId).toBe('cover')
  })
})
