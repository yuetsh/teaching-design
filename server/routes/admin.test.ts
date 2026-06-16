import { beforeEach, describe, expect, it } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { hashPassword, signAccessToken, verifyPassword } from '../auth'
import { createRefreshToken, createUser, findRefreshTokenByHash, findUserById, openDb } from '../db'
import { createAdminRouter } from './admin'

const JWT_SECRET = 'test-secret'

describe('admin routes', () => {
  let app: Hono
  let db: Database
  let adminToken: string
  let userToken: string
  let adminId: string
  let userId: string

  beforeEach(async () => {
    db = openDb(':memory:')
    const adminHash = await hashPassword('adminpass')
    const userHash = await hashPassword('userpass')
    const admin = createUser(db, { username: 'admin', passwordHash: adminHash, role: 'admin' })
    const user = createUser(db, { username: 'alice', passwordHash: userHash, role: 'user' })
    adminId = admin.id
    userId = user.id
    adminToken = await signAccessToken(admin.id, 'admin', JWT_SECRET)
    userToken = await signAccessToken(user.id, 'user', JWT_SECRET)
    app = new Hono().route('/api/admin', createAdminRouter(db, JWT_SECRET))
  })

  it('lists users for admin', async () => {
    const res = await app.request('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; username: string }[]
    expect(body.length).toBe(2)
    expect(body[0]).not.toHaveProperty('passwordHash')
  })

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.request('/api/admin/users')
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const res = await app.request('/api/admin/users', {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('creates a new user', async () => {
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', password: 'pass123', role: 'user' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { username: string; role: string }
    expect(body.username).toBe('bob')
    expect(body.role).toBe('user')
    expect(body).not.toHaveProperty('passwordHash')
  })

  it('returns 400 when creating user without required fields', async () => {
    const res = await app.request('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob' }),
    })
    expect(res.status).toBe(400)
  })

  it('deletes a user', async () => {
    const res = await app.request(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('prevents deleting yourself', async () => {
    const res = await app.request(`/api/admin/users/${adminId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when deleting missing user', async () => {
    const res = await app.request('/api/admin/users/missing', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(404)
  })

  it('resets a user password to the fixed temporary password', async () => {
    createRefreshToken(db, { userId, tokenHash: 'user-refresh-token', expiresAt: '2099-01-01T00:00:00.000Z' })

    const res = await app.request(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const updated = findUserById(db, userId)
    expect(updated).not.toBeNull()
    expect(await verifyPassword('123456', updated!.passwordHash)).toBe(true)
    expect(await verifyPassword('userpass', updated!.passwordHash)).toBe(false)
    expect(findRefreshTokenByHash(db, 'user-refresh-token')).toBeNull()
  })

  it('returns 404 when resetting password for missing user', async () => {
    const res = await app.request('/api/admin/users/missing/reset-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: '用户不存在' })
  })

  it('returns 403 when non-admin resets a password', async () => {
    const res = await app.request(`/api/admin/users/${adminId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })

    expect(res.status).toBe(403)
  })
})
