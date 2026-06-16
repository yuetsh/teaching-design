import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { hashPassword } from './auth'
import { createUser, findUserByUsername, openDb } from './db'
import { bearerAuth } from './middleware/bearerAuth'
import { createAuthRouter } from './routes/auth'
import { createAdminRouter } from './routes/admin'
import { createBooksRouter } from './routes/books'
import { createGenerateRouter } from './routes/generate'

const db = openDb(process.env.TEACHING_BOOKS_DB ?? 'data/teaching-books.db')

async function initAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return
  if (findUserByUsername(db, username)) return
  const hash = await hashPassword(password)
  createUser(db, { username, passwordHash: hash, role: 'admin' })
  console.log(`[auth] admin user "${username}" created`)
}

const jwtSecret = process.env.JWT_SECRET ?? ''

export const app = new Hono()

app.route('/api/auth', createAuthRouter(db, jwtSecret))
app.route('/api/admin', createAdminRouter(db, jwtSecret))

app.use('/api/books/*', bearerAuth(jwtSecret))
app.use('/api/generate/*', bearerAuth(jwtSecret))

app.route('/api/books', createBooksRouter(db))
app.route('/api/generate', createGenerateRouter(process.env.DEEPSEEK_API_KEY))

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

if (import.meta.main) {
  await initAdmin()
  Bun.serve({
    port: process.env.PORT ? Number(process.env.PORT) : 3001,
    fetch: app.fetch,
  })
}
