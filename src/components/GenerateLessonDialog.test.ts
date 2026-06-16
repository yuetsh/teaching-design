import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GenerateLessonDialog from './GenerateLessonDialog.vue'

describe('GenerateLessonDialog', () => {
  it('disables submit until a topic is entered', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: null } })

    const submit = wrapper.findAll('button')[0]!
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('CSS 弹性布局')
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('emits submit with the trimmed topic', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: null } })

    await wrapper.get('input').setValue('  CSS 弹性布局  ')
    await wrapper.findAll('button')[0]!.trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['CSS 弹性布局']])
  })

  it('shows a loading state and disables interaction', () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: true, error: null } })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button')[0]!.text()).toContain('生成中')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeDefined()
  })

  it('shows an error message and allows retry without closing', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: 'Deepseek 请求失败。' } })

    expect(wrapper.text()).toContain('Deepseek 请求失败。')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('CSS 弹性布局')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeUndefined()
  })

  it('emits cancel', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: null } })

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
