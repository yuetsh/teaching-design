import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import LessonSidebar from './LessonSidebar.vue'

describe('LessonSidebar', () => {
  it('emits a move when one lesson is dropped on another', async () => {
    const designs = [createEmptyTeachingDesign('1.md'), createEmptyTeachingDesign('2.md')]
    const wrapper = mount(LessonSidebar, {
      props: { designs, selectedId: designs[0]?.id ?? 'cover' },
    })

    await wrapper.get('[data-index="0"]').trigger('dragstart')
    await wrapper.get('[data-index="1"]').trigger('drop')

    expect(wrapper.emitted('move')?.[0]).toEqual([0, 1])
  })
})
