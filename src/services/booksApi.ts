import type { TeachingBook } from '../domain/teachingDesign'
import { authedFetch } from '../composables/useAuth'

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

export interface GenerateResult {
  filename: string
  markdown: string
}

export function listBooks(): Promise<BookSummary[]> {
  return authedFetch('/api/books')
}

export function createBook(name: string): Promise<BookRecord> {
  return authedFetch('/api/books', { method: 'POST', body: JSON.stringify({ name }) })
}

export function getBook(id: string): Promise<BookRecord> {
  return authedFetch(`/api/books/${id}`)
}

export function updateBook(id: string, data: TeachingBook): Promise<BookMeta> {
  return authedFetch(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify({ data }) })
}

export function renameBook(id: string, name: string): Promise<BookMeta> {
  return authedFetch(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function deleteBook(id: string): Promise<{ ok: true }> {
  return authedFetch(`/api/books/${id}`, { method: 'DELETE' })
}

export function generateLesson(topic: string): Promise<GenerateResult> {
  return authedFetch('/api/generate', { method: 'POST', body: JSON.stringify({ topic }) })
}

export function generateOutline(theme: string): Promise<{ titles: string[] }> {
  return authedFetch('/api/generate/outline', { method: 'POST', body: JSON.stringify({ theme }) })
}
