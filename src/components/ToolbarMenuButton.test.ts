import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToolbarMenuButton from './ToolbarMenuButton.vue'

function mountMenu(props: { label: string; toggleTestid: string; disabled?: boolean }) {
  return mount(ToolbarMenuButton, {
    props,
    attachTo: document.body,
    slots: {
      default: `<template #default="{ close }">
        <li role="menuitem"><button data-testid="item-a" @click="close">Item A</button></li>
        <li role="menuitem"><button data-testid="item-b" @click="close">Item B</button></li>
      </template>`,
    },
  })
}

describe('ToolbarMenuButton', () => {
  it('renders the toggle button with the given label and closed menu by default', () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    expect(wrapper.get('button[data-testid="export-menu-toggle"]').text()).toBe('导出 ▾')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the menu when the toggle button is clicked', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="item-a"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="item-b"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('closes the menu when a slot item calls close', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="item-a"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when clicking outside the component', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(true)

    document.body.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when Escape is pressed', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(true)

    await wrapper.get('div.toolbar-menu').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables the toggle button and never opens the menu when disabled is true', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle', disabled: true })
    expect(wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled')).toBeDefined()
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
