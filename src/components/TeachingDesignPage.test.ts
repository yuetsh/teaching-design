import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign, type TeachingDesign } from '../domain/teachingDesign'
import TeachingDesignPage from './TeachingDesignPage.vue'

describe('TeachingDesignPage', () => {
  it('does not show an empty additional content section while editing', () => {
    const design = createEmptyTeachingDesign('1.md')

    const wrapper = mount(TeachingDesignPage, {
      props: { design, editable: true },
    })

    expect(wrapper.text()).not.toContain('附加内容')
  })

  it('adds and removes teaching process rows', async () => {
    const design = createEmptyTeachingDesign('1.md')
    const wrapper = mount(TeachingDesignPage, {
      props: { design, editable: true },
    })

    await wrapper.get('[data-testid="add-step"]').trigger('click')
    expect(
      wrapper.emitted<TeachingDesign[]>('update:design')?.at(-1)?.[0]?.processSteps,
    ).toHaveLength(2)
  })
})
