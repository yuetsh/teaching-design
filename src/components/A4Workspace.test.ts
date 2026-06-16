import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import A4Workspace from './A4Workspace.vue'

describe('A4Workspace', () => {
  it('renders a selected lesson without cover state', () => {
    const design = createEmptyTeachingDesign('1.md')
    design.topic = 'CSS 弹性布局'

    const wrapper = mount(A4Workspace, {
      props: { selectedDesign: design },
    })

    expect(Object.keys(wrapper.props()).sort()).toEqual(['selectedDesign'])
    expect(wrapper.find('.cover-page').exists()).toBe(false)
    expect(wrapper.find('.teaching-design-page').exists()).toBe(true)
  })

  it('renders no page when no lesson is selected', () => {
    const wrapper = mount(A4Workspace, {
      props: { selectedDesign: null },
    })

    expect(wrapper.find('.page').exists()).toBe(false)
  })
})
