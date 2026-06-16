import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook } from '../../shared/domain/teachingDesign'
import * as booksApi from './booksApi'

describe('booksApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists books', async () => {
    const summaries = [{ id: 'b1', name: 'Web', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 2 }]
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(summaries), { status: 200 }))

    await expect(booksApi.listBooks()).resolves.toEqual(summaries)
    expect(fetch).toHaveBeenCalledWith('/api/books', expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('creates a book', async () => {
    const created = { id: 'b1', name: '新整本', updatedAt: '2026-01-01T00:00:00.000Z', data: createEmptyBook() }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(created), { status: 200 }))

    await expect(booksApi.createBook('新整本')).resolves.toEqual(created)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ name: '新整本' })
  })

  it('gets a book', async () => {
    const record = { id: 'b1', name: 'Web', updatedAt: '2026-01-01T00:00:00.000Z', data: createEmptyBook() }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(record), { status: 200 }))

    await expect(booksApi.getBook('b1')).resolves.toEqual(record)
    expect(fetch).toHaveBeenCalledWith('/api/books/b1', expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('updates a book', async () => {
    const meta = { id: 'b1', name: 'Web', updatedAt: '2026-01-02T00:00:00.000Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(meta), { status: 200 }))

    const data = createEmptyBook()
    await expect(booksApi.updateBook('b1', data)).resolves.toEqual(meta)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ data })
  })

  it('renames a book', async () => {
    const meta = { id: 'b1', name: '新名称', updatedAt: '2026-01-01T00:00:00.000Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(meta), { status: 200 }))

    await expect(booksApi.renameBook('b1', '新名称')).resolves.toEqual(meta)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ name: '新名称' })
  })

  it('deletes a book', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await expect(booksApi.deleteBook('b1')).resolves.toEqual({ ok: true })

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('DELETE')
  })

  it('generates a lesson', async () => {
    const result = { filename: 'css-flex.md', markdown: '# CSS 弹性布局 教学设计' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))

    await expect(booksApi.generateLesson('CSS 弹性布局')).resolves.toEqual(result)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(JSON.parse(init?.body as string)).toEqual({ topic: 'CSS 弹性布局' })
  })

  it('throws the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: '整本不存在。' }), { status: 404 }))

    await expect(booksApi.getBook('missing')).rejects.toThrow('整本不存在。')
  })

  it('throws a generic error when the response has no error message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }))

    await expect(booksApi.getBook('b1')).rejects.toThrow('请求失败（500）')
  })
})
