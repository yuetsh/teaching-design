import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyBook } from '../domain/teachingDesign'
import { clearStoredBook, loadStoredBook, saveBook } from './bookStorage'

describe('bookStorage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a versioned book', () => {
    const book = createEmptyBook()
    book.cover.courseName = 'Web 前端开发'

    expect(saveBook(book)).toEqual({ ok: true })
    expect(loadStoredBook()?.cover.courseName).toBe('Web 前端开发')
  })

  it('returns null for malformed storage', () => {
    localStorage.setItem('teaching-design-book', '{bad json')
    expect(loadStoredBook()).toBeNull()
  })

  it('clears saved work', () => {
    saveBook(createEmptyBook())
    clearStoredBook()
    expect(loadStoredBook()).toBeNull()
  })
})
