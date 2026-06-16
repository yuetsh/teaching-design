import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPage from './AdminPage.vue'

const { authedFetch, logout } = vi.hoisted(() => ({
  authedFetch: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('../composables/useAuth', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
  useAuth: () => ({ logout }),
}))

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authedFetch.mockResolvedValue([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('uses shared app control classes', async () => {
    const wrapper = mount(AdminPage)
    await flushPromises()

    expect(wrapper.get('.admin-page').classes()).toContain('app-page')
    expect(wrapper.get('header').classes()).toContain('app-page-header')
    expect(wrapper.get('input[placeholder="用户名"]').classes()).toContain('ui-field')
    expect(wrapper.get('input[placeholder="密码"]').classes()).toContain('ui-field')
    expect(wrapper.get('select').classes()).toContain('ui-select')
    expect(wrapper.get('button[type="submit"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--primary']),
    )
    expect(wrapper.get('table').classes()).toContain('ui-table')
    expect(wrapper.get('button[data-testid="delete-user-u1"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--danger']),
    )
  })
})
