import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UploadDropzone from './UploadDropzone.vue'

describe('UploadDropzone', () => {
  it('emits every selected file', async () => {
    const wrapper = mount(UploadDropzone)
    const files = [new File(['# one'], '1.md'), new File(['# two'], '2.md')]
    const input = wrapper.get('input[type="file"]')

    Object.defineProperty(input.element, 'files', { value: files })
    await input.trigger('change')

    expect(wrapper.emitted('files')?.[0]?.[0]).toEqual(files)
  })
})
