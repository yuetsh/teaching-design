import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook, createEmptyTeachingDesign } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import GenerateLessonDialog from './GenerateLessonDialog.vue'
import WorkspaceView from './WorkspaceView.vue'

vi.mock('../services/booksApi')

function mockBook(data = createEmptyBook()): void {
  vi.mocked(booksApi.getBook).mockResolvedValue({
    id: 'b1',
    name: '示例整本',
    updatedAt: '2026-01-01T00:00:00.000Z',
    data,
  })
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
})
