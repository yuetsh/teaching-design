import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { openDb } from './db'
import { createBooksRouter } from './routes/books'
import { createGenerateRouter } from './routes/generate'

const db = openDb(process.env.TEACHING_BOOKS_DB ?? 'data/teaching-books.db')

export const app = new Hono()

app.route('/api/books', createBooksRouter(db))
app.route('/api/generate', createGenerateRouter(process.env.DEEPSEEK_API_KEY))

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

if (import.meta.main) {
  Bun.serve({
    port: process.env.PORT ? Number(process.env.PORT) : 3001,
    fetch: app.fetch,
  })
}
