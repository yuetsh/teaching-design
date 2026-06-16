import { beforeEach, describe, expect, it } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { hashPassword } from '../auth'
import { createUser, openDb } from '../db'
import { createAuthRouter } from './auth'

const JWT_SECRET = 'test-secret'

describe('auth routes', () => {
  let app: Hono
  let db: Database

  beforeEach(async () => {
    db = openDb(':memory:')
    const hash = await hashPassword('password123')
    createUser(db, { username: 'alice', passwordHash: hash, role: 'user' })
    createUser(db, { username: 'admin', passwordHash: await hashPassword('adminpass'), role: 'admin' })
    app = new Hono().route('/api/auth', createAuthRouter(db, JWT_SECRET))
  })

  it('returns 401 for wrong password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 for unknown user', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'password123' }),
    })
    expect(res.status).toBe(401)
  })

  it('logs in and returns access + refresh tokens', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { accessToken: string; refreshToken: string; user: { username: string; role: string } }
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.user.username).toBe('alice')
    expect(body.user.role).toBe('user')
    expect(body.user).not.toHaveProperty('passwordHash')
  })

  it('returns user info via /me with valid token', async () => {
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    })
    const { accessToken } = await loginRes.json() as { accessToken: string }

    const meRes = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(meRes.status).toBe(200)
    const me = await meRes.json() as { username: string }
    expect(me.username).toBe('alice')
  })

  it('returns 401 for /me without token', async () => {
    const res = await app.request('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('refreshes access token using refresh token', async () => {
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    })
    const { refreshToken } = await loginRes.json() as { refreshToken: string }

    const refreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(refreshRes.status).toBe(200)
    const body = await refreshRes.json() as { accessToken: string }
    expect(typeof body.accessToken).toBe('string')
  })

  it('returns 401 for unknown refresh token', async () => {
    const res = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'bogus-token' }),
    })
    expect(res.status).toBe(401)
  })

  it('logs out by invalidating refresh token', async () => {
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    })
    const { refreshToken } = await loginRes.json() as { refreshToken: string }

    const logoutRes = await app.request('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(logoutRes.status).toBe(200)

    const refreshRes = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    expect(refreshRes.status).toBe(401)
  })
})
