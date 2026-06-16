import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { createEmptyBook, createEmptyTeachingDesign } from '../src/domain/teachingDesign'
import { createBook, deleteBook, getBook, listBooks, openDb, renameBook, saveBookData } from './db'

afterEach(() => {
  setSystemTime()
})

describe('db', () => {
  it('creates a book with empty data', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')

    expect(created.name).toBe('示例整本')
    expect(created.data.designs).toEqual([])
    expect(created.data.schemaVersion).toBe(1)
  })

  it('retrieves a created book by id', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')

    expect(getBook(db, created.id)).toEqual(created)
  })

  it('returns null for a missing book', () => {
    const db = openDb(':memory:')
    expect(getBook(db, 'missing')).toBeNull()
  })

  it('lists books ordered by most recently updated, with lesson counts', () => {
    const db = openDb(':memory:')
    setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const first = createBook(db, '第一本')
    setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
    const second = createBook(db, '第二本')

    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    setSystemTime(new Date('2026-01-03T00:00:00.000Z'))
    saveBookData(db, first.id, data)

    const books = listBooks(db)

    expect(books.map((book) => book.id)).toEqual([first.id, second.id])
    expect(books[0]?.lessonCount).toBe(1)
    expect(books[1]?.lessonCount).toBe(0)
  })

  it('saves book data and updates updated_at', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')
    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'

    setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    const result = saveBookData(db, created.id, data)

    expect(result).toEqual({ id: created.id, name: '示例整本', updatedAt: '2026-02-01T00:00:00.000Z' })
    expect(getBook(db, created.id)?.data.cover.courseName).toBe('Web 前端开发')
  })

  it('returns null when saving data for a missing book', () => {
    const db = openDb(':memory:')
    expect(saveBookData(db, 'missing', createEmptyBook())).toBeNull()
  })

  it('renames a book without changing updated_at', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '旧名称')

    const result = renameBook(db, created.id, '新名称')

    expect(result).toEqual({ id: created.id, name: '新名称', updatedAt: created.updatedAt })
    expect(getBook(db, created.id)?.name).toBe('新名称')
  })

  it('returns null when renaming a missing book', () => {
    const db = openDb(':memory:')
    expect(renameBook(db, 'missing', '新名称')).toBeNull()
  })

  it('deletes a book', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')

    expect(deleteBook(db, created.id)).toBe(true)
    expect(getBook(db, created.id)).toBeNull()
  })

  it('returns false when deleting a missing book', () => {
    const db = openDb(':memory:')
    expect(deleteBook(db, 'missing')).toBe(false)
  })
})
