import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../../shared/domain/teachingDesign'
import { createBookZip } from './zipExporter'

describe('createBookZip', () => {
  it('keeps original lesson filenames and adds an order manifest', async () => {
    const second = createEmptyTeachingDesign('2.md')
    second.topic = '第二课'
    const first = createEmptyTeachingDesign('1.md')
    first.topic = '第一课'

    const blob = await createBookZip([second, first])
    const zip = await JSZip.loadAsync(blob)

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(['2.md', '1.md', '课程顺序.txt']),
    )
    await expect(zip.file('课程顺序.txt')?.async('text')).resolves.toContain('1. 2.md')
  })

  it('disambiguates duplicate filenames', async () => {
    const first = createEmptyTeachingDesign('1.md')
    first.topic = '第一课甲'
    const duplicate = createEmptyTeachingDesign('1.md')
    duplicate.topic = '第一课乙'

    const blob = await createBookZip([first, duplicate])
    const zip = await JSZip.loadAsync(blob)

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(['1.md', '1-2.md', '课程顺序.txt']),
    )
  })
})
