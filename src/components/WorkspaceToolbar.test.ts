import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkspaceToolbar from './WorkspaceToolbar.vue'

function mountToolbar(lessonCount: number): ReturnType<typeof mount> {
  return mount(WorkspaceToolbar, {
    props: { lessonCount, warningCount: 0, saveStatus: 'idle' },
  })
}

describe('WorkspaceToolbar', () => {
  it('renders the lesson count', () => {
    const wrapper = mountToolbar(3)
    expect(wrapper.text()).toContain('共 3 课')
  })

  it('emits generate when the generate button is clicked', async () => {
    const wrapper = mountToolbar(3)
    await wrapper.get('button[data-testid="generate"]').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('emits back when the back button is clicked', async () => {
    const wrapper = mountToolbar(0)
    await wrapper.get('button[data-testid="back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('keeps generate and back enabled even with no lessons', () => {
    const wrapper = mountToolbar(0)
    expect(wrapper.get('button[data-testid="generate"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[data-testid="back"]').attributes('disabled')).toBeUndefined()
  })

  it('disables print, export and clear when there are no lessons', () => {
    const wrapper = mountToolbar(0)
    expect(wrapper.get('button[data-testid="print"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[data-testid="export"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[data-testid="clear"]').attributes('disabled')).toBeDefined()
  })
})
