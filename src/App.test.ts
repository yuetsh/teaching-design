import { flushPromises, mount } from '@vue/test-utils'
import { computed } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { createEmptyBook } from './domain/teachingDesign'
import * as booksApi from './services/booksApi'

vi.mock('./services/booksApi')

const authState = vi.hoisted(() => ({
  authedFetch: vi.fn(),
  fetchMe: vi.fn(),
  loggedIn: true,
  login: vi.fn(),
  logout: vi.fn(),
  user: null as { id: string; username: string; role: 'admin' | 'user' } | null,
}))

vi.mock('./composables/useAuth', () => ({
  authedFetch: authState.authedFetch,
  useAuth: () => ({
    fetchMe: authState.fetchMe,
    isLoggedIn: computed(() => authState.loggedIn),
    login: authState.login,
    logout: authState.logout,
    user: computed(() => authState.user),
  }),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.authedFetch.mockResolvedValue([])
    authState.loggedIn = true
    authState.user = null
    window.history.replaceState(null, '', '/books')
  })

  it('starts with the book list entry page', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('教学设计')
    expect(wrapper.text()).toContain('新建整本')
  })

  it('opens a book route when a book is selected', async () => {
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

    expect(window.location.pathname).toBe('/books/b1')
    expect(wrapper.find('[data-testid="back"]').exists()).toBe(true)
  })

  it('returns to the books route from the workspace', async () => {
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

    expect(window.location.pathname).toBe('/books')
    expect(wrapper.text()).toContain('教学设计')
  })

  it('opens the admin route from the book list', async () => {
    authState.user = { id: 'u1', username: 'admin', role: 'admin' }
    vi.mocked(booksApi.listBooks).mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    const adminButton = wrapper.findAll('button').find((button) => button.text() === '用户管理')
    expect(adminButton).toBeDefined()

    await adminButton!.trigger('click')
    await flushPromises()

    expect(window.location.pathname).toBe('/admin')
    expect(wrapper.text()).toContain('用户管理')
  })

  it('routes logged-out users to login', async () => {
    authState.loggedIn = false
    window.history.replaceState(null, '', '/books/b1')

    const wrapper = mount(App)
    await flushPromises()

    expect(window.location.pathname).toBe('/login')
    expect(wrapper.text()).toContain('登录')
  })
})
