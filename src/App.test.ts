import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => localStorage.clear())

  it('starts with the multi-file upload screen', () => {
    const wrapper = mount(App)
    expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeDefined()
    expect(wrapper.text()).toContain('上传 Markdown')
  })
})
