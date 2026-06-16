import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { createEmptyBook, createEmptyTeachingDesign } from '../src/domain/teachingDesign'
import {
  createBook, deleteBook, getBook, listBooks, openDb, renameBook, saveBookData,
  createUser, findUserByUsername, findUserById, listUsers, deleteUser, updateUserPasswordHash,
  createRefreshToken, findRefreshTokenByHash, deleteRefreshTokenByHash, deleteRefreshTokensForUser,
} from './db'

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

describe('users and refresh tokens', () => {
  it('creates a user and finds them by username', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'alice', passwordHash: 'hash1', role: 'user' })

    expect(user.username).toBe('alice')
    expect(user.role).toBe('user')
    expect(findUserByUsername(db, 'alice')).toEqual(user)
  })

  it('returns null for unknown username', () => {
    const db = openDb(':memory:')
    expect(findUserByUsername(db, 'nobody')).toBeNull()
  })

  it('finds user by id', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'bob', passwordHash: 'hash2', role: 'admin' })
    expect(findUserById(db, user.id)).toEqual(user)
  })

  it('lists users ordered by creation time', () => {
    const db = openDb(':memory:')
    const a = createUser(db, { username: 'alice', passwordHash: 'h', role: 'user' })
    const b = createUser(db, { username: 'bob', passwordHash: 'h', role: 'admin' })
    const list = listUsers(db)
    expect(list.map((u) => u.id)).toEqual([a.id, b.id])
    expect(list[0]).not.toHaveProperty('passwordHash')
  })

  it('deletes a user and cascades to refresh tokens', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'carol', passwordHash: 'h', role: 'user' })
    createRefreshToken(db, { userId: user.id, tokenHash: 'hash123', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(deleteUser(db, user.id)).toBe(true)
    expect(findUserByUsername(db, 'carol')).toBeNull()
    expect(findRefreshTokenByHash(db, 'hash123')).toBeNull()
  })

  it('returns false when deleting missing user', () => {
    const db = openDb(':memory:')
    expect(deleteUser(db, 'missing')).toBe(false)
  })

  it('updates a user password hash', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'frank', passwordHash: 'old-hash', role: 'user' })

    expect(updateUserPasswordHash(db, user.id, 'new-hash')).toBe(true)
    expect(findUserById(db, user.id)?.passwordHash).toBe('new-hash')
  })

  it('returns false when updating password hash for missing user', () => {
    const db = openDb(':memory:')
    expect(updateUserPasswordHash(db, 'missing', 'new-hash')).toBe(false)
  })

  it('creates and finds a refresh token by hash', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'dave', passwordHash: 'h', role: 'user' })
    const token = createRefreshToken(db, { userId: user.id, tokenHash: 'abc123', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(findRefreshTokenByHash(db, 'abc123')).toEqual(token)
  })

  it('deletes a refresh token by hash', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'eve', passwordHash: 'h', role: 'user' })
    createRefreshToken(db, { userId: user.id, tokenHash: 'xyz', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(deleteRefreshTokenByHash(db, 'xyz')).toBe(true)
    expect(findRefreshTokenByHash(db, 'xyz')).toBeNull()
  })

  it('deletes refresh tokens for one user', () => {
    const db = openDb(':memory:')
    const first = createUser(db, { username: 'grace', passwordHash: 'h', role: 'user' })
    const second = createUser(db, { username: 'heidi', passwordHash: 'h', role: 'user' })
    createRefreshToken(db, { userId: first.id, tokenHash: 'first-token', expiresAt: '2099-01-01T00:00:00.000Z' })
    createRefreshToken(db, { userId: second.id, tokenHash: 'second-token', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(deleteRefreshTokensForUser(db, first.id)).toBe(1)
    expect(findRefreshTokenByHash(db, 'first-token')).toBeNull()
    expect(findRefreshTokenByHash(db, 'second-token')).not.toBeNull()
  })
})
