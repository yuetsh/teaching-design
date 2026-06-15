import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditableMarkdown from './EditableMarkdown.vue'

describe('EditableMarkdown', () => {
  it('renders markdown when blurred and edits raw markdown when activated', async () => {
    const wrapper = mount(EditableMarkdown, {
      props: { modelValue: '**重点**内容', label: '教师活动' },
    })

    expect(wrapper.get('.markdown-preview strong').text()).toBe('重点')
    await wrapper.get('.markdown-preview').trigger('click')
    expect(wrapper.get('textarea').element.value).toBe('**重点**内容')
  })
})
