import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import PrintBook from './PrintBook.vue'

describe('PrintBook', () => {
  it('renders one cover and every lesson in current order', () => {
    const first = createEmptyTeachingDesign('2.md')
    first.topic = '第二课'
    const second = createEmptyTeachingDesign('1.md')
    second.topic = '第一课'

    const wrapper = mount(PrintBook, {
      props: {
        cover: { courseName: 'Web 前端开发', teacherName: '张老师' },
        designs: [first, second],
      },
    })

    expect(wrapper.findAll('.print-section')).toHaveLength(3)
    expect(wrapper.text().indexOf('第二课')).toBeLessThan(wrapper.text().indexOf('第一课'))
  })
})
