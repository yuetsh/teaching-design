import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GenerateMenuButton from './GenerateMenuButton.vue'

describe('GenerateMenuButton', () => {
  it('renders the toggle button with the menu closed by default', () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    expect(wrapper.get('button[data-testid="generate-menu-toggle"]').text()).toContain('生成教案')
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="batch-generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the menu when the toggle button is clicked', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="generate"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="batch-generate"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('emits generate and closes the menu when "生成一篇" is clicked', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="generate"]').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits batchGenerate and closes the menu when "批量生成" is clicked', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="batch-generate"]').trigger('click')
    expect(wrapper.emitted('batchGenerate')).toHaveLength(1)
    expect(wrapper.find('[data-testid="batch-generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when clicking outside the component', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(true)

    document.body.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when Escape is pressed', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(true)

    await wrapper.get('div.generate-menu').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
