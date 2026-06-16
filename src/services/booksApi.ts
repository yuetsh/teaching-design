import type { TeachingBook } from '../domain/teachingDesign'

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

interface ErrorBody {
  error?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null
    throw new Error(body?.error ?? `请求失败（${response.status}）。`)
  }

  return response.json() as Promise<T>
}

export function listBooks(): Promise<BookSummary[]> {
  return request('/api/books')
}

export function createBook(name: string): Promise<BookRecord> {
  return request('/api/books', { method: 'POST', body: JSON.stringify({ name }) })
}

export function getBook(id: string): Promise<BookRecord> {
  return request(`/api/books/${id}`)
}

export function updateBook(id: string, data: TeachingBook): Promise<BookMeta> {
  return request(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify({ data }) })
}

export function renameBook(id: string, name: string): Promise<BookMeta> {
  return request(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function deleteBook(id: string): Promise<{ ok: true }> {
  return request(`/api/books/${id}`, { method: 'DELETE' })
}

export function generateLesson(topic: string): Promise<GenerateResult> {
  return request('/api/generate', { method: 'POST', body: JSON.stringify({ topic }) })
}
