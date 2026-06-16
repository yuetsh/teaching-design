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

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

export function openDb(path: string): Database {
  const db = new Database(path)
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
