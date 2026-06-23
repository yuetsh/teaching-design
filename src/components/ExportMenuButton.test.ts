import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExportMenuButton from './ExportMenuButton.vue'

describe('ExportMenuButton', () => {
  it('renders the toggle button with the menu closed by default', () => {
    const wrapper = mount(ExportMenuButton, { attachTo: document.body })
    expect(wrapper.get('button[data-testid="export-menu-toggle"]').text()).toContain('导出')
    expect(wrapper.find('[data-testid="print"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits print and closes the menu when "打印整册" is clicked', async () => {
    const wrapper = mount(ExportMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="print"]').trigger('click')
    expect(wrapper.emitted('print')).toHaveLength(1)
    expect(wrapper.find('[data-testid="print"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits export and closes the menu when "导出 MD" is clicked', async () => {
    const wrapper = mount(ExportMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="export"]').trigger('click')
    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.find('[data-testid="export"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables the toggle button when disabled prop is true', () => {
    const wrapper = mount(ExportMenuButton, {
      props: { disabled: true },
      attachTo: document.body,
    })
    expect(
      wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('keeps the toggle button enabled when disabled prop is false', () => {
    const wrapper = mount(ExportMenuButton, {
      props: { disabled: false },
      attachTo: document.body,
    })
    expect(
      wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled'),
    ).toBeUndefined()
    wrapper.unmount()
  })
})
