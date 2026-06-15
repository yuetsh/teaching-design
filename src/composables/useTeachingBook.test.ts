import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTeachingBook } from './useTeachingBook'

describe('useTeachingBook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('imports files in natural order and selects the first lesson', async () => {
    const store = useTeachingBook()
    const files = [
      new File(['# 第十课 教学设计'], '10.md', { type: 'text/markdown' }),
      new File(['# 第二课 教学设计'], '2.md', { type: 'text/markdown' }),
    ]

    await store.importFiles(files, 'keep')

    expect(store.book.value.designs.map((design) => design.originalFilename)).toEqual([
      '2.md',
      '10.md',
    ])
    expect(store.book.value.selectedId).toBe(store.book.value.designs[0]?.id)
  })

  it('reorders lessons without changing their identities', async () => {
    const store = useTeachingBook()
    await store.importFiles([
      new File(['# One 教学设计'], '1.md'),
      new File(['# Two 教学设计'], '2.md'),
    ], 'keep')

    const ids = store.book.value.designs.map((design) => design.id)
    store.moveDesign(0, 1)

    expect(store.book.value.designs.map((design) => design.id)).toEqual(ids.reverse())
  })
})
