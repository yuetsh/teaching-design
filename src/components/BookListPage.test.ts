import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import BookListPage from './BookListPage.vue'

vi.mock('../services/booksApi')

describe('BookListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the list of books', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 3 },
    ])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Web 前端开发')
    expect(wrapper.text()).toContain('更新于 2026/01/01')
    expect(wrapper.text()).not.toContain('2026-01-01T00:00:00.000Z')
    expect(wrapper.text()).toContain('3 课')
  })

  it('shows an empty state when there are no books', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.text()).toContain('还没有整本')
  })

  it('shows an error and allows retry when loading fails', async () => {
    vi.mocked(booksApi.listBooks).mockRejectedValueOnce(new Error('网络错误。'))
    vi.mocked(booksApi.listBooks).mockResolvedValueOnce([])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.text()).toContain('网络错误。')

    await wrapper.get('button[data-testid="retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('还没有整本')
  })

  it('creates a book and emits open with the new id', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])
    vi.mocked(booksApi.createBook).mockResolvedValue({
      id: 'new-id',
      name: '新整本',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: createEmptyBook(),
    })

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('input[aria-label="新整本名称"]').setValue('新整本')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(booksApi.createBook).toHaveBeenCalledWith('新整本')
    expect(wrapper.emitted('open')).toEqual([['new-id']])
  })

  it('renames a book', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: '旧名称', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.renameBook).mockResolvedValue({ id: 'b1', name: '新名称', updatedAt: '2026-01-02T00:00:00.000Z' })

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('button[data-testid="rename-b1"]').trigger('click')
    await wrapper.get('input[aria-label="整本名称"]').setValue('新名称')
    await wrapper.get('button[data-testid="confirm-rename-b1"]').trigger('click')
    await flushPromises()

    expect(booksApi.renameBook).toHaveBeenCalledWith('b1', '新名称')
    expect(wrapper.text()).toContain('新名称')
  })

  it('deletes a book after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.deleteBook).mockResolvedValue({ ok: true })

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('button[data-testid="delete-b1"]').trigger('click')
    await flushPromises()

    expect(booksApi.deleteBook).toHaveBeenCalledWith('b1')
    expect(wrapper.text()).toContain('还没有整本')
  })

  it('does not delete a book when confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('button[data-testid="delete-b1"]').trigger('click')
    await flushPromises()

    expect(booksApi.deleteBook).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Web 前端开发')
  })
})
