import { BOOK_SCHEMA_VERSION, type TeachingBook } from '../domain/teachingDesign'

const STORAGE_KEY = 'teaching-design-book'

export type SaveResult = { ok: true } | { ok: false; message: string }

export function saveBook(book: TeachingBook): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(book))
    return { ok: true }
  } catch {
    return { ok: false, message: '浏览器存储空间不足，当前修改尚未暂存。' }
  }
}

export function loadStoredBook(): TeachingBook | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TeachingBook
    return parsed.schemaVersion === BOOK_SCHEMA_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function clearStoredBook(): void {
  localStorage.removeItem(STORAGE_KEY)
}
