import type { MiddlewareHandler } from 'hono'
import { verifyAccessToken } from '../auth'

export type AuthVariables = { userId: string; role: string }

export function bearerAuth(secret: string): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const auth = c.req.header('Authorization')
    if (!auth?.startsWith('Bearer ')) {
      return c.json({ error: '未授权' }, 401)
    }
    const token = auth.slice(7)
    const payload = await verifyAccessToken(token, secret)
    if (!payload) {
      return c.json({ error: '未授权' }, 401)
    }
    c.set('userId', payload.userId)
    c.set('role', payload.role)
    await next()
  }
}
