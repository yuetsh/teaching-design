import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import type { TeachingBook } from '../../shared/domain/teachingDesign'
import { createBook, deleteBook, getBook, listBooks, renameBook, saveBookData } from '../db'
import type { AuthVariables } from '../middleware/bearerAuth'

export function createBooksRouter(db: Database): Hono<{ Variables: AuthVariables }> {
  const app = new Hono<{ Variables: AuthVariables }>()

  app.get('/', (c) => {
    return c.json(listBooks(db))
  })

  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null
    const name = body?.name

    if (typeof name !== 'string' || name.trim() === '') {
      return c.json({ error: '请提供整本名称。' }, 400)
    }

    return c.json(createBook(db, name.trim(), c.get('userId')))
  })

  app.get('/:id', (c) => {
    const book = getBook(db, c.req.param('id'))
    if (!book) return c.json({ error: '整本不存在。' }, 404)
    return c.json(book)
  })

  app.put('/:id', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { data?: TeachingBook } | null
    if (!body?.data) {
      return c.json({ error: '请提供整本数据。' }, 400)
    }

    const result = saveBookData(db, c.req.param('id'), body.data)
    if (!result) return c.json({ error: '整本不存在。' }, 404)
    return c.json(result)
  })

  app.patch('/:id', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null
    const name = body?.name

    if (typeof name !== 'string' || name.trim() === '') {
      return c.json({ error: '请提供整本名称。' }, 400)
    }

    const result = renameBook(db, c.req.param('id'), name.trim())
    if (!result) return c.json({ error: '整本不存在。' }, 404)
    return c.json(result)
  })

  app.delete('/:id', (c) => {
    if (!deleteBook(db, c.req.param('id'))) {
      return c.json({ error: '整本不存在。' }, 404)
    }
    return c.json({ ok: true })
  })

  return app
}
