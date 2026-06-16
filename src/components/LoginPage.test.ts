import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage.vue'

const { login } = vi.hoisted(() => ({
  login: vi.fn(),
}))

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ login }),
}))

describe('LoginPage', () => {
  it('uses shared form field and primary button classes', () => {
    const wrapper = mount(LoginPage)

    expect(wrapper.get('#username').classes()).toContain('ui-field')
    expect(wrapper.get('#password').classes()).toContain('ui-field')
    expect(wrapper.get('button[type="submit"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--primary']),
    )
  })
})
