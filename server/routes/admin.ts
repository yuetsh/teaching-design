import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { hashPassword } from '../auth'
import { createUser, deleteUser, listUsers } from '../db'
import { bearerAuth, type AuthVariables } from '../middleware/bearerAuth'

export function createAdminRouter(db: Database, jwtSecret: string) {
  const app = new Hono<{ Variables: AuthVariables }>()

  app.use('/*', bearerAuth(jwtSecret))
  app.use('/*', async (c, next) => {
    if (c.get('role') !== 'admin') return c.json({ error: '无权限' }, 403)
    await next()
  })

  app.get('/users', (c) => {
    return c.json(listUsers(db))
  })

  app.post('/users', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      username?: unknown
      password?: unknown
      role?: unknown
    } | null

    if (
      typeof body?.username !== 'string' ||
      body.username.trim() === '' ||
      typeof body?.password !== 'string' ||
      body.password.length < 1
    ) {
      return c.json({ error: '请提供用户名和密码' }, 400)
    }

    const role = body.role === 'admin' ? 'admin' : 'user'
    const passwordHash = await hashPassword(body.password)
    const user = createUser(db, { username: body.username.trim(), passwordHash, role })
    return c.json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt })
  })

  app.delete('/users/:id', (c) => {
    const targetId = c.req.param('id')
    if (targetId === c.get('userId')) {
      return c.json({ error: '不能删除自己的账号' }, 400)
    }
    if (!deleteUser(db, targetId)) {
      return c.json({ error: '用户不存在' }, 404)
    }
    return c.json({ ok: true })
  })

  return app
}
