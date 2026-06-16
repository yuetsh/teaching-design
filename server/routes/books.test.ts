import { beforeEach, describe, expect, it } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { createEmptyBook } from '../../src/domain/teachingDesign'
import { openDb } from '../db'
import { createBooksRouter } from './books'

describe('books routes', () => {
  let app: Hono
  let db: Database

  beforeEach(() => {
    db = openDb(':memory:')
    app = new Hono().route('/api/books', createBooksRouter(db))
  })

  async function createViaApi(name: string): Promise<{ id: string }> {
    const res = await app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return (await res.json()) as { id: string }
  }

  it('lists no books initially', async () => {
    const res = await app.request('/api/books')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates a book', async () => {
    const res = await app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '示例整本' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { name: string; data: { designs: unknown[] } }
    expect(body.name).toBe('示例整本')
    expect(body.data.designs).toEqual([])
  })

  it('returns 400 when creating without a name', async () => {
    const res = await app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('gets a created book', async () => {
    const created = await createViaApi('示例整本')

    const res = await app.request(`/api/books/${created.id}`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { id: string }).id).toBe(created.id)
  })

  it('returns 404 for a missing book', async () => {
    const res = await app.request('/api/books/missing')
    expect(res.status).toBe(404)
  })

  it('saves book data', async () => {
    const created = await createViaApi('示例整本')

    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    expect(res.status).toBe(200)

    const fetched = await app.request(`/api/books/${created.id}`)
    const body = (await fetched.json()) as { data: { cover: { courseName: string } } }
    expect(body.data.cover.courseName).toBe('Web 前端开发')
  })

  it('returns 404 when saving data for a missing book', async () => {
    const res = await app.request('/api/books/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: createEmptyBook() }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when saving without data', async () => {
    const created = await createViaApi('示例整本')

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('renames a book', async () => {
    const created = await createViaApi('旧名称')

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名称' }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { name: string }).name).toBe('新名称')
  })

  it('returns 404 when renaming a missing book', async () => {
    const res = await app.request('/api/books/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名称' }),
    })
    expect(res.status).toBe(404)
  })

  it('deletes a book', async () => {
    const created = await createViaApi('示例整本')

    const res = await app.request(`/api/books/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect((await app.request(`/api/books/${created.id}`)).status).toBe(404)
  })

  it('returns 404 when deleting a missing book', async () => {
    const res = await app.request('/api/books/missing', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
