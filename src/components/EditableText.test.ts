import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditableText from './EditableText.vue'

describe('EditableText', () => {
  it('emits updates while keeping an accessible label', async () => {
    const wrapper = mount(EditableText, {
      props: { modelValue: '旧内容', label: '课题' },
    })

    await wrapper.get('textarea').setValue('新内容')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['新内容'])
    expect(wrapper.get('textarea').attributes('aria-label')).toBe('课题')
  })
})
