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
    authedFetch.mockReset()
    logout.mockReset()
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
    expect(wrapper.get('button[data-testid="reset-password-u1"]').classes()).toContain('ui-button')
    expect(wrapper.get('button[data-testid="delete-user-u1"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--danger']),
    )
  })

  it('resets a user password after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    authedFetch.mockResolvedValueOnce([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    authedFetch.mockResolvedValueOnce({ ok: true })

    const wrapper = mount(AdminPage)
    await flushPromises()

    await wrapper.get('button[data-testid="reset-password-u1"]').trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalledWith('确定要将该用户密码重置为 123456 吗？')
    expect(authedFetch).toHaveBeenCalledWith('/api/admin/users/u1/reset-password', { method: 'POST' })
    expect(wrapper.text()).toContain('已将密码重置为 123456。')
  })

  it('does not reset a password when confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    authedFetch.mockResolvedValueOnce([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])

    const wrapper = mount(AdminPage)
    await flushPromises()

    await wrapper.get('button[data-testid="reset-password-u1"]').trigger('click')
    await flushPromises()

    expect(authedFetch).toHaveBeenCalledTimes(1)
  })
})
