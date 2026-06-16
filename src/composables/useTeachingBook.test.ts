import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook, createEmptyTeachingDesign, type TeachingBook } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import { useTeachingBook } from './useTeachingBook'

vi.mock('../services/booksApi')

function mockGetBook(data: TeachingBook, id = 'b1'): void {
  vi.mocked(booksApi.getBook).mockResolvedValue({ id, name: '示例整本', updatedAt: data.updatedAt, data })
}

function createBookWithDesign(filename = '1.md'): { data: TeachingBook; design: ReturnType<typeof createEmptyTeachingDesign> } {
  const data = createEmptyBook()
  const design = createEmptyTeachingDesign(filename)
  data.designs.push(design)
  data.selectedId = design.id
  return { data, design }
}

function generatedMarkdownWithAdditionalSection(topic: string): string {
  return [
    `# ${topic} 教学设计`,
    '| | |',
    '|:---|:---|',
    `| **课题** | **${topic}** |`,
    '| **课时** | 1课时（40分钟） |',
    '| **教学目标** | **知识目标**：理解概念。<br>**技能目标**：完成任务。<br>**素养目标**：规范表达。 |',
    '| **教学重难点** | **重点**：任务流程。<br>**难点**：问题定位。 |',
    '| **教学资源准备** | 机房、示例文件。 |',
    '',
    '## 教学过程',
    '',
    '| 教学环节 | 教学内容 | 教师活动 | 学生活动 | 设计意图 |',
    '|:---|:---|:---|:---|:---|',
    '| **1. 导入**<br>（5分钟） | 引出任务。 | **情境导入**<br>展示案例。 | **观察思考**<br>回答问题。 | 明确目标。 |',
    '',
    '## 板书设计',
    '',
    '```text',
    `${topic}`,
    '```',
    '',
    '## 教学成效与反思',
    '',
    '| | |',
    '|:---|:---|',
    '| **教学成效** | 学生完成任务。 |',
    '| **教学反思** | 后续加强练习。 |',
    '',
    '## 附加说明',
    '',
    '这是模型额外生成的内容。',
  ].join('\n')
}

describe('useTeachingBook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('loads the book from the API without cover state', async () => {
    const { data } = createBookWithDesign()
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    expect(booksApi.getBook).toHaveBeenCalledWith('b1')
    expect(store.loadStatus.value).toBe('loaded')
    expect(store.book.value).not.toHaveProperty('cover')
    expect(store.book.value.selectedId).toBe(data.selectedId)
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
    const { data, design } = createBookWithDesign()
    mockGetBook(data)
    vi.mocked(booksApi.updateBook).mockResolvedValue({ id: 'b1', name: '示例整本', updatedAt: 'later' })

    const store = useTeachingBook('b1')
    await flushPromises()

    store.updateDesign(design.id, (current) => {
      current.title = '新课程名'
    })
    await vi.advanceTimersByTimeAsync(300)

    expect(booksApi.updateBook).toHaveBeenCalledWith('b1', store.book.value)
    expect(store.saveStatus.value).toBe('saved')
  })

  it('sets saveStatus to error when autosave fails', async () => {
    const { data, design } = createBookWithDesign()
    mockGetBook(data)
    vi.mocked(booksApi.updateBook).mockRejectedValue(new Error('保存失败。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    store.updateDesign(design.id, (current) => {
      current.title = '新课程名'
    })
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

  it('generateLesson discards unclassified additional content from AI output', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.generateLesson).mockResolvedValue({
      filename: 'css-flex.md',
      markdown: generatedMarkdownWithAdditionalSection('CSS 弹性布局'),
    })

    const store = useTeachingBook('b1')
    await flushPromises()

    const result = await store.generateLesson('CSS 弹性布局')

    expect(result).toEqual({ ok: true })
    expect(store.book.value.designs[0]?.additionalContent).toBe('')
    expect(store.book.value.designs[0]?.warnings).not.toContainEqual(
      expect.objectContaining({ code: 'unclassified-content' }),
    )
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

  it('clearBook empties designs and clears selection', async () => {
    const { data } = createBookWithDesign()
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    store.clearBook()

    expect(store.book.value.designs).toEqual([])
    expect(store.book.value).not.toHaveProperty('cover')
    expect(store.book.value.selectedId).toBeNull()
  })

  it('selects null after removing the last selected lesson', async () => {
    const { data, design } = createBookWithDesign()
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    store.removeDesign(design.id)
    await flushPromises()

    expect(store.book.value.designs).toEqual([])
    expect(store.book.value.selectedId).toBeNull()
    expect(store.selectedDesign.value).toBeNull()
  })
})
