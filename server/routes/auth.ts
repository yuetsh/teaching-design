import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { hashToken, signAccessToken, verifyPassword } from '../auth'
import {
  createRefreshToken,
  deleteRefreshTokenByHash,
  findRefreshTokenByHash,
  findUserById,
  findUserByUsername,
} from '../db'
import { bearerAuth } from '../middleware/bearerAuth'

function refreshExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString()
}

export function createAuthRouter(db: Database, jwtSecret: string) {
  const app = new Hono<{ Variables: { userId: string; role: string } }>()

  app.post('/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string') {
      return c.json({ error: '请提供用户名和密码' }, 400)
    }
    const user = findUserByUsername(db, body.username)
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return c.json({ error: '用户名或密码错误' }, 401)
    }
    const accessToken = await signAccessToken(user.id, user.role, jwtSecret)
    const rawRefresh = crypto.randomUUID()
    createRefreshToken(db, {
      userId: user.id,
      tokenHash: hashToken(rawRefresh),
      expiresAt: refreshExpiresAt(),
    })
    return c.json({
      accessToken,
      refreshToken: rawRefresh,
      user: { id: user.id, username: user.username, role: user.role },
    })
  })

  app.post('/refresh', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { refreshToken?: unknown } | null
    if (typeof body?.refreshToken !== 'string') {
      return c.json({ error: '请提供 refresh token' }, 400)
    }
    const record = findRefreshTokenByHash(db, hashToken(body.refreshToken))
    if (!record || new Date(record.expiresAt) < new Date()) {
      return c.json({ error: '无效或已过期的 refresh token' }, 401)
    }
    const user = findUserById(db, record.userId)
    if (!user) return c.json({ error: '用户不存在' }, 401)
    const accessToken = await signAccessToken(user.id, user.role, jwtSecret)
    return c.json({ accessToken })
  })

  app.post('/logout', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { refreshToken?: unknown } | null
    if (typeof body?.refreshToken === 'string') {
      deleteRefreshTokenByHash(db, hashToken(body.refreshToken))
    }
    return c.json({ ok: true })
  })

  app.get('/me', bearerAuth(jwtSecret), (c) => {
    const user = findUserById(db, c.get('userId'))
    if (!user) return c.json({ error: '用户不存在' }, 404)
    return c.json({ id: user.id, username: user.username, role: user.role })
  })

  return app
}
