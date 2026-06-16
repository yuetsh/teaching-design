import { Database } from 'bun:sqlite'
import { createEmptyBook, type TeachingBook } from '../src/domain/teachingDesign'

export interface BookSummary {
  id: string
  name: string
  updatedAt: string
  lessonCount: number
}

export interface BookRecord {
  id: string
  name: string
  updatedAt: string
  data: TeachingBook
}

export interface BookMeta {
  id: string
  name: string
  updatedAt: string
}

interface BookRow {
  id: string
  name: string
  data: string
  updated_at: string
}

export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface UserSummary {
  id: string
  username: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  createdAt: string
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`

export function openDb(path: string): Database {
  const db = new Database(path)
  db.run('PRAGMA foreign_keys = ON')
  db.run(SCHEMA)
  return db
}

export function listBooks(db: Database): BookSummary[] {
  const rows = db
    .query<BookRow, []>('SELECT id, name, data, updated_at FROM books ORDER BY updated_at DESC')
    .all()

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    lessonCount: (JSON.parse(row.data) as TeachingBook).designs.length,
  }))
}

export function createBook(db: Database, name: string): BookRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const data = createEmptyBook()
  data.updatedAt = now

  db.run('INSERT INTO books (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    name,
    JSON.stringify(data),
    now,
    now,
  ])

  return { id, name, updatedAt: now, data }
}

export function getBook(db: Database, id: string): BookRecord | null {
  const row = db
    .query<BookRow, [string]>('SELECT id, name, data, updated_at FROM books WHERE id = ?')
    .get(id)
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    data: JSON.parse(row.data) as TeachingBook,
  }
}

export function saveBookData(db: Database, id: string, data: TeachingBook): BookMeta | null {
  const existing = db
    .query<{ name: string }, [string]>('SELECT name FROM books WHERE id = ?')
    .get(id)
  if (!existing) return null

  const now = new Date().toISOString()
  db.run('UPDATE books SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data), now, id])

  return { id, name: existing.name, updatedAt: now }
}

export function renameBook(db: Database, id: string, name: string): BookMeta | null {
  const existing = db
    .query<{ updated_at: string }, [string]>('SELECT updated_at FROM books WHERE id = ?')
    .get(id)
  if (!existing) return null

  db.run('UPDATE books SET name = ? WHERE id = ?', [name, id])

  return { id, name, updatedAt: existing.updated_at }
}

export function deleteBook(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM books WHERE id = ?', [id])
  return result.changes > 0
}

export function createUser(
  db: Database,
  params: { username: string; passwordHash: string; role: 'admin' | 'user' },
): UserRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.run('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    params.username,
    params.passwordHash,
    params.role,
    now,
  ])
  return { id, username: params.username, passwordHash: params.passwordHash, role: params.role, createdAt: now }
}

export function findUserByUsername(db: Database, username: string): UserRecord | null {
  const row = db
    .query<{ id: string; username: string; password_hash: string; role: string; created_at: string }, [string]>(
      'SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?',
    )
    .get(username)
  if (!row) return null
  return { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as 'admin' | 'user', createdAt: row.created_at }
}

export function findUserById(db: Database, id: string): UserRecord | null {
  const row = db
    .query<{ id: string; username: string; password_hash: string; role: string; created_at: string }, [string]>(
      'SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?',
    )
    .get(id)
  if (!row) return null
  return { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as 'admin' | 'user', createdAt: row.created_at }
}

export function listUsers(db: Database): UserSummary[] {
  return db
    .query<{ id: string; username: string; role: string; created_at: string }, []>(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC',
    )
    .all()
    .map((row) => ({ id: row.id, username: row.username, role: row.role as 'admin' | 'user', createdAt: row.created_at }))
}

export function deleteUser(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM users WHERE id = ?', [id])
  return result.changes > 0
}

export function createRefreshToken(
  db: Database,
  params: { userId: string; tokenHash: string; expiresAt: string },
): RefreshTokenRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, params.userId, params.tokenHash, params.expiresAt, now],
  )
  return { id, userId: params.userId, tokenHash: params.tokenHash, expiresAt: params.expiresAt, createdAt: now }
}

export function findRefreshTokenByHash(db: Database, tokenHash: string): RefreshTokenRecord | null {
  const row = db
    .query<{ id: string; user_id: string; token_hash: string; expires_at: string; created_at: string }, [string]>(
      'SELECT id, user_id, token_hash, expires_at, created_at FROM refresh_tokens WHERE token_hash = ?',
    )
    .get(tokenHash)
  if (!row) return null
  return { id: row.id, userId: row.user_id, tokenHash: row.token_hash, expiresAt: row.expires_at, createdAt: row.created_at }
}

export function deleteRefreshTokenByHash(db: Database, tokenHash: string): boolean {
  const result = db.run('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash])
  return result.changes > 0
}
