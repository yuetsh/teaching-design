import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook, createEmptyTeachingDesign } from '../../shared/domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import * as zipExporter from '../services/zipExporter'
import BatchGenerateDialog from './BatchGenerateDialog.vue'
import GenerateLessonDialog from './GenerateLessonDialog.vue'
import WorkspaceView from './WorkspaceView.vue'

vi.mock('../services/booksApi')
vi.mock('../services/zipExporter')

function mockBook(data = createEmptyBook()): void {
  vi.mocked(booksApi.getBook).mockResolvedValue({
    id: 'b1',
    name: '示例整本',
    updatedAt: '2026-01-01T00:00:00.000Z',
    data,
  })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function generatedLesson(topic: string): booksApi.GenerateResult {
  return {
    filename: `${topic}.md`,
    markdown: [
      `# ${topic} 教学设计`,
      '|:---|:---|',
      `| **课题** | **${topic}** |`,
      '| **课时** | 1课时（40分钟） |',
    ].join('\n'),
  }
}

describe('WorkspaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while the book loads', () => {
    vi.mocked(booksApi.getBook).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })

    expect(wrapper.text()).toContain('加载中')
  })

  it('shows an error and emits back when loading fails', async () => {
    vi.mocked(booksApi.getBook).mockRejectedValue(new Error('整本不存在。'))

    const wrapper = mount(WorkspaceView, { props: { bookId: 'missing' } })
    await flushPromises()

    expect(wrapper.text()).toContain('整本不存在。')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('renders the toolbar and emits back when loaded', async () => {
    mockBook()

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    expect(wrapper.text()).toContain('点击或拖拽上传')

    await wrapper.get('[data-testid="back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('opens the generate dialog and adds a generated lesson on submit', async () => {
    mockBook()
    vi.mocked(booksApi.generateLesson).mockResolvedValue({
      filename: 'css-flex.md',
      markdown: '# CSS 弹性布局 教学设计',
    })

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    await wrapper.get('[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('[data-testid="generate"]').trigger('click')
    const dialog = wrapper.getComponent(GenerateLessonDialog)

    dialog.vm.$emit('submit', 'CSS 弹性布局')
    await flushPromises()

    expect(booksApi.generateLesson).toHaveBeenCalledWith('CSS 弹性布局')
    expect(wrapper.findComponent(GenerateLessonDialog).exists()).toBe(false)
    expect(wrapper.text()).toContain('CSS 弹性布局')
  })

  it('does not render cover navigation when lessons exist', async () => {
    const data = createEmptyBook()
    const design = createEmptyTeachingDesign('1.md')
    data.designs.push(design)
    data.selectedId = design.id
    mockBook(data)

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('封面')
  })

  it('batch generates up to three lessons concurrently and keeps outline order', async () => {
    mockBook()
    const requests = new Map<string, ReturnType<typeof deferred<booksApi.GenerateResult>>>()
    vi.mocked(booksApi.generateLesson).mockImplementation((topic) => {
      const request = deferred<booksApi.GenerateResult>()
      requests.set(topic, request)
      return request.promise
    })

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    await wrapper.get('[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('[data-testid="batch-generate"]').trigger('click')
    wrapper.getComponent(BatchGenerateDialog).vm.$emit('start', [
      '第一课',
      '第二课',
      '第三课',
      '第四课',
      '第五课',
    ])
    await flushPromises()

    expect(booksApi.generateLesson).toHaveBeenCalledTimes(3)
    expect(booksApi.generateLesson).toHaveBeenNthCalledWith(1, '第一课')
    expect(booksApi.generateLesson).toHaveBeenNthCalledWith(2, '第二课')
    expect(booksApi.generateLesson).toHaveBeenNthCalledWith(3, '第三课')

    requests.get('第三课')!.resolve(generatedLesson('第三课'))
    await flushPromises()
    expect(booksApi.generateLesson).toHaveBeenCalledTimes(4)
    expect(booksApi.generateLesson).toHaveBeenNthCalledWith(4, '第四课')
    expect(wrapper.findAll('.lesson-sidebar-topic').map((node) => node.text())).toEqual([])

    requests.get('第四课')!.resolve(generatedLesson('第四课'))
    await flushPromises()
    expect(booksApi.generateLesson).toHaveBeenCalledTimes(5)
    expect(booksApi.generateLesson).toHaveBeenNthCalledWith(5, '第五课')

    requests.get('第一课')!.resolve(generatedLesson('第一课'))
    await flushPromises()
    expect(wrapper.findAll('.lesson-sidebar-topic').map((node) => node.text())).toEqual(['第一课'])

    requests.get('第二课')!.resolve(generatedLesson('第二课'))
    await flushPromises()
    expect(wrapper.findAll('.lesson-sidebar-topic').map((node) => node.text())).toEqual([
      '第一课',
      '第二课',
      '第三课',
      '第四课',
    ])

    requests.get('第五课')!.resolve(generatedLesson('第五课'))
    await flushPromises()
    expect(wrapper.findAll('.lesson-sidebar-topic').map((node) => node.text())).toEqual([
      '第一课',
      '第二课',
      '第三课',
      '第四课',
      '第五课',
    ])
  })

  it('clears the lessons after confirmation', async () => {
    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    mockBook(data)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    await wrapper.get('[data-testid="clear"]').trigger('click')

    expect(wrapper.text()).toContain('点击或拖拽上传')
  })

  it('downloads the exported zip with the book name', async () => {
    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    const blob = new Blob(['zip'])
    mockBook(data)
    vi.mocked(zipExporter.createBookZip).mockResolvedValue(blob)

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    await wrapper.get('[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('[data-testid="export"]').trigger('click')
    await flushPromises()

    expect(zipExporter.downloadBlob).toHaveBeenCalledWith(blob, '示例整本.zip')
  })
})
