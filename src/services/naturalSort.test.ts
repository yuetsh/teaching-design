import { describe, expect, it } from 'vitest'
import { sortFilesNaturally } from './naturalSort'

describe('sortFilesNaturally', () => {
  it('sorts numbered filenames naturally without mutating the input', () => {
    const files = [{ name: '10.md' }, { name: '2.md' }, { name: '1.md' }]
    const original = [...files]

    const sorted = sortFilesNaturally(files)

    expect(sorted.map(({ name }) => name)).toEqual(['1.md', '2.md', '10.md'])
    expect(files).toEqual(original)
    expect(sorted).not.toBe(files)
  })
})
