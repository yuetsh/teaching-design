import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { createEmptyBook } from './domain/teachingDesign'
import * as booksApi from './services/booksApi'

vi.mock('./services/booksApi')

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with the book list entry page', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('教学设计整本')
    expect(wrapper.text()).toContain('新建整本')
  })

  it('switches to the workspace view when a book is opened', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: '示例整本', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.getBook).mockResolvedValue({
      id: 'b1',
      name: '示例整本',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: createEmptyBook(),
    })

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="open-b1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="back"]').exists()).toBe(true)
  })

  it('returns to the book list when back is emitted', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: '示例整本', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.getBook).mockResolvedValue({
      id: 'b1',
      name: '示例整本',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: createEmptyBook(),
    })

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="open-b1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="back"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('教学设计整本')
  })
})
