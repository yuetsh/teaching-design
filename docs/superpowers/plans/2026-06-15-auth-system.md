# Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login-gated user account system so only authenticated users can access the app's books and AI generation features.

**Architecture:** JWT access token (15 min, stateless) + refresh token (7 days, stored in DB for revocability). Server uses Hono middleware to protect existing routes. Frontend uses a module-level singleton `useAuth.ts` composable with `authedFetch` replacing all `booksApi.ts` fetch calls. App.vue reactively shows `LoginPage` when `isLoggedIn` is false.

**Tech Stack:** Hono (hono/jwt for sign/verify), Bun.password (built-in bcrypt), bun:sqlite, Vue 3 Composition API, bun:test (server tests), vitest (frontend tests)

---

## File Map

**Create:**
- `server/routes/auth.ts` — login / refresh / logout / me endpoints
- `server/routes/auth.test.ts` — bun:test for auth routes
- `server/routes/admin.ts` — user CRUD endpoints (admin only)
- `server/routes/admin.test.ts` — bun:test for admin routes
- `server/auth.ts` — pure crypto utilities (hash, JWT)
- `server/auth.test.ts` — bun:test for crypto utilities
- `server/middleware/bearerAuth.ts` — Hono middleware that validates Bearer JWT
- `src/composables/useAuth.ts` — singleton auth state + authedFetch
- `src/components/LoginPage.vue` — login form
- `src/components/AdminPage.vue` — user management (admin only)

**Modify:**
- `server/db.ts` — add users + refresh_tokens tables and CRUD
- `server/db.test.ts` — add tests for new CRUD functions
- `server/index.ts` — mount auth/admin routes, protect books/generate, init admin
- `src/services/booksApi.ts` — replace request() with authedFetch()
- `src/App.vue` — login gate + admin page navigation
- `src/components/BookListPage.vue` — add admin button for admin users
- `.env` — add JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

---

## Task 1: Extend DB schema with users + refresh_tokens

**Files:**
- Modify: `server/db.ts`
- Modify: `server/db.test.ts`

- [ ] **Step 1: Add types and schema to server/db.ts**

Append after the existing `BookRow` interface and `SCHEMA` constant. Replace the full `SCHEMA` string:

```ts
export interface UserRecord {
  id: string
  username: string
  passwordHash: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface UserSummary {
  id: string
  username: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface RefreshTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  createdAt: string
}
```

Change `const SCHEMA = ...` to:

```ts
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`
```

- [ ] **Step 2: Add user CRUD functions to server/db.ts**

Append after `deleteBook`:

```ts
export function createUser(
  db: Database,
  params: { username: string; passwordHash: string; role: 'admin' | 'user' },
): UserRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.run('INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    params.username,
    params.passwordHash,
    params.role,
    now,
  ])
  return { id, username: params.username, passwordHash: params.passwordHash, role: params.role, createdAt: now }
}

export function findUserByUsername(db: Database, username: string): UserRecord | null {
  const row = db
    .query<{ id: string; username: string; password_hash: string; role: string; created_at: string }, [string]>(
      'SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?',
    )
    .get(username)
  if (!row) return null
  return { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as 'admin' | 'user', createdAt: row.created_at }
}

export function findUserById(db: Database, id: string): UserRecord | null {
  const row = db
    .query<{ id: string; username: string; password_hash: string; role: string; created_at: string }, [string]>(
      'SELECT id, username, password_hash, role, created_at FROM users WHERE id = ?',
    )
    .get(id)
  if (!row) return null
  return { id: row.id, username: row.username, passwordHash: row.password_hash, role: row.role as 'admin' | 'user', createdAt: row.created_at }
}

export function listUsers(db: Database): UserSummary[] {
  return db
    .query<{ id: string; username: string; role: string; created_at: string }, []>(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC',
    )
    .all()
    .map((row) => ({ id: row.id, username: row.username, role: row.role as 'admin' | 'user', createdAt: row.created_at }))
}

export function deleteUser(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM users WHERE id = ?', [id])
  return result.changes > 0
}
```

- [ ] **Step 3: Add refresh token CRUD functions to server/db.ts**

Append after `deleteUser`:

```ts
export function createRefreshToken(
  db: Database,
  params: { userId: string; tokenHash: string; expiresAt: string },
): RefreshTokenRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, params.userId, params.tokenHash, params.expiresAt, now],
  )
  return { id, userId: params.userId, tokenHash: params.tokenHash, expiresAt: params.expiresAt, createdAt: now }
}

export function findRefreshTokenByHash(db: Database, tokenHash: string): RefreshTokenRecord | null {
  const row = db
    .query<{ id: string; user_id: string; token_hash: string; expires_at: string; created_at: string }, [string]>(
      'SELECT id, user_id, token_hash, expires_at, created_at FROM refresh_tokens WHERE token_hash = ?',
    )
    .get(tokenHash)
  if (!row) return null
  return { id: row.id, userId: row.user_id, tokenHash: row.token_hash, expiresAt: row.expires_at, createdAt: row.created_at }
}

export function deleteRefreshTokenByHash(db: Database, tokenHash: string): boolean {
  const result = db.run('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash])
  return result.changes > 0
}
```

- [ ] **Step 4: Write failing tests in server/db.test.ts**

Add a new `describe('users and refresh tokens', ...)` block at the end of the file:

```ts
describe('users and refresh tokens', () => {
  it('creates a user and finds them by username', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'alice', passwordHash: 'hash1', role: 'user' })

    expect(user.username).toBe('alice')
    expect(user.role).toBe('user')
    expect(findUserByUsername(db, 'alice')).toEqual(user)
  })

  it('returns null for unknown username', () => {
    const db = openDb(':memory:')
    expect(findUserByUsername(db, 'nobody')).toBeNull()
  })

  it('finds user by id', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'bob', passwordHash: 'hash2', role: 'admin' })
    expect(findUserById(db, user.id)).toEqual(user)
  })

  it('lists users ordered by creation time', () => {
    const db = openDb(':memory:')
    const a = createUser(db, { username: 'alice', passwordHash: 'h', role: 'user' })
    const b = createUser(db, { username: 'bob', passwordHash: 'h', role: 'admin' })
    const list = listUsers(db)
    expect(list.map((u) => u.id)).toEqual([a.id, b.id])
    expect(list[0]).not.toHaveProperty('passwordHash')
  })

  it('deletes a user and cascades to refresh tokens', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'carol', passwordHash: 'h', role: 'user' })
    createRefreshToken(db, { userId: user.id, tokenHash: 'hash123', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(deleteUser(db, user.id)).toBe(true)
    expect(findUserByUsername(db, 'carol')).toBeNull()
    expect(findRefreshTokenByHash(db, 'hash123')).toBeNull()
  })

  it('returns false when deleting missing user', () => {
    const db = openDb(':memory:')
    expect(deleteUser(db, 'missing')).toBe(false)
  })

  it('creates and finds a refresh token by hash', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'dave', passwordHash: 'h', role: 'user' })
    const token = createRefreshToken(db, { userId: user.id, tokenHash: 'abc123', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(findRefreshTokenByHash(db, 'abc123')).toEqual(token)
  })

  it('deletes a refresh token by hash', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'eve', passwordHash: 'h', role: 'user' })
    createRefreshToken(db, { userId: user.id, tokenHash: 'xyz', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(deleteRefreshTokenByHash(db, 'xyz')).toBe(true)
    expect(findRefreshTokenByHash(db, 'xyz')).toBeNull()
  })
})
```

Also add the new imports at the top of the import line:

```ts
import {
  createBook, deleteBook, getBook, listBooks, openDb, renameBook, saveBookData,
  createUser, findUserByUsername, findUserById, listUsers, deleteUser,
  createRefreshToken, findRefreshTokenByHash, deleteRefreshTokenByHash,
} from './db'
```

- [ ] **Step 5: Run tests**

```bash
bun test server/db.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/db.ts server/db.test.ts
git commit -m "feat: add users and refresh_tokens tables and CRUD"
```

---

## Task 2: Create server/auth.ts — pure crypto utilities

**Files:**
- Create: `server/auth.ts`
- Create: `server/auth.test.ts`

- [ ] **Step 1: Write failing tests in server/auth.test.ts**

```ts
import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { hashPassword, hashToken, signAccessToken, verifyAccessToken, verifyPassword } from './auth'

afterEach(() => {
  setSystemTime()
})

describe('auth utilities', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('signs and verifies an access token', async () => {
    const token = await signAccessToken('user1', 'admin', 'mysecret')
    const payload = await verifyAccessToken(token, 'mysecret')
    expect(payload).toEqual({ userId: 'user1', role: 'admin' })
  })

  it('returns null for an expired access token', async () => {
    setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const token = await signAccessToken('user1', 'user', 'mysecret')

    setSystemTime(new Date('2026-01-01T00:16:00.000Z'))
    const payload = await verifyAccessToken(token, 'mysecret')
    expect(payload).toBeNull()
  })

  it('returns null for an access token with wrong secret', async () => {
    const token = await signAccessToken('user1', 'user', 'mysecret')
    const payload = await verifyAccessToken(token, 'wrongsecret')
    expect(payload).toBeNull()
  })

  it('hashToken is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('xyz'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test server/auth.test.ts
```

Expected: FAIL with "Cannot find module './auth'"

- [ ] **Step 3: Create server/auth.ts**

```ts
import { sign, verify } from 'hono/jwt'

export interface AccessTokenPayload {
  userId: string
  role: string
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

export async function signAccessToken(
  userId: string,
  role: string,
  secret: string,
): Promise<string> {
  return sign(
    { userId, role, exp: Math.floor(Date.now() / 1000) + 15 * 60 },
    secret,
  )
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload | null> {
  try {
    const payload = await verify(token, secret) as { userId: string; role: string }
    return { userId: payload.userId, role: payload.role }
  } catch {
    return null
  }
}

export function hashToken(token: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(token)
  return hasher.digest('hex')
}
```

- [ ] **Step 4: Run tests**

```bash
bun test server/auth.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/auth.ts server/auth.test.ts
git commit -m "feat: add auth crypto utilities (password hash, JWT, token hash)"
```

---

## Task 3: Create server/middleware/bearerAuth.ts

**Files:**
- Create: `server/middleware/bearerAuth.ts`

- [ ] **Step 1: Create the middleware**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add server/middleware/bearerAuth.ts
git commit -m "feat: add bearerAuth Hono middleware"
```

---

## Task 4: Create server/routes/auth.ts + tests

**Files:**
- Create: `server/routes/auth.ts`
- Create: `server/routes/auth.test.ts`

- [ ] **Step 1: Write failing tests in server/routes/auth.test.ts**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test server/routes/auth.test.ts
```

Expected: FAIL with "Cannot find module './auth'"

- [ ] **Step 3: Create server/routes/auth.ts**

```ts
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

export function createAuthRouter(db: Database, jwtSecret: string): Hono {
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
```

- [ ] **Step 4: Run tests**

```bash
bun test server/routes/auth.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.ts server/routes/auth.test.ts
git commit -m "feat: add auth routes (login, refresh, logout, me)"
```

---

## Task 5: Create server/routes/admin.ts + tests

**Files:**
- Create: `server/routes/admin.ts`
- Create: `server/routes/admin.test.ts`

- [ ] **Step 1: Write failing tests in server/routes/admin.test.ts**

```ts
import { beforeEach, describe, expect, it } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { hashPassword, signAccessToken } from '../auth'
import { createUser, openDb } from '../db'
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
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test server/routes/admin.test.ts
```

Expected: FAIL with "Cannot find module './admin'"

- [ ] **Step 3: Create server/routes/admin.ts**

```ts
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { hashPassword } from '../auth'
import { createUser, deleteUser, listUsers } from '../db'
import { bearerAuth, type AuthVariables } from '../middleware/bearerAuth'

export function createAdminRouter(db: Database, jwtSecret: string): Hono {
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
```

- [ ] **Step 4: Run tests**

```bash
bun test server/routes/admin.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin.ts server/routes/admin.test.ts
git commit -m "feat: add admin routes (list/create/delete users)"
```

---

## Task 6: Wire server/index.ts — mount routes, protect existing endpoints, init admin

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Replace server/index.ts**

```ts
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
```

- [ ] **Step 2: Verify existing server tests still pass**

```bash
bun test server
```

Expected: all tests pass. Note — books.test.ts creates its own Hono app without auth middleware, so it is unaffected.

- [ ] **Step 3: Update .env**

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

Add to `.env`:

```
JWT_SECRET=<output from above command>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<choose a strong password>
```

- [ ] **Step 4: Commit**

```bash
git add server/index.ts .env
git commit -m "feat: wire auth middleware and init admin on startup"
```

---

## Task 7: Create src/composables/useAuth.ts

**Files:**
- Create: `src/composables/useAuth.ts`

- [ ] **Step 1: Create src/composables/useAuth.ts**

```ts
import { computed, ref } from 'vue'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'user'
}

export interface UserSummary extends AuthUser {
  createdAt: string
}

const accessToken = ref<string | null>(localStorage.getItem('access_token'))
const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
const user = ref<AuthUser | null>(null)

export const isLoggedIn = computed(() => !!accessToken.value)

function clearTokens(): void {
  accessToken.value = null
  refreshToken.value = null
  user.value = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function doRefresh(): Promise<boolean> {
  if (!refreshToken.value) return false
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshToken.value }),
  })
  if (!res.ok) {
    clearTokens()
    return false
  }
  const body = (await res.json()) as { accessToken: string }
  accessToken.value = body.accessToken
  localStorage.setItem('access_token', body.accessToken)
  return true
}

export async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  }
  if (accessToken.value) headers['Authorization'] = `Bearer ${accessToken.value}`

  let res = await fetch(path, { ...init, headers })

  if (res.status === 401) {
    const refreshed = await doRefresh()
    if (!refreshed) throw new Error('未登录')
    if (accessToken.value) headers['Authorization'] = `Bearer ${accessToken.value}`
    res = await fetch(path, { ...init, headers })
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `请求失败（${res.status}）`)
  }

  return res.json() as Promise<T>
}

export function useAuth() {
  async function login(username: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? '登录失败')
    }
    const body = (await res.json()) as {
      accessToken: string
      refreshToken: string
      user: AuthUser
    }
    accessToken.value = body.accessToken
    refreshToken.value = body.refreshToken
    user.value = body.user
    localStorage.setItem('access_token', body.accessToken)
    localStorage.setItem('refresh_token', body.refreshToken)
  }

  async function logout(): Promise<void> {
    if (refreshToken.value) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken.value }),
      }).catch(() => {})
    }
    clearTokens()
  }

  async function fetchMe(): Promise<void> {
    if (!accessToken.value) return
    try {
      user.value = await authedFetch<AuthUser>('/api/auth/me')
    } catch {
      clearTokens()
    }
  }

  return { isLoggedIn, user, login, logout, fetchMe }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/composables/useAuth.ts
git commit -m "feat: add useAuth composable with singleton token state and authedFetch"
```

---

## Task 8: Update src/services/booksApi.ts to use authedFetch

**Files:**
- Modify: `src/services/booksApi.ts`

- [ ] **Step 1: Replace the file**

Replace the entire `request` helper and all function bodies to use `authedFetch`:

```ts
import type { TeachingBook } from '../domain/teachingDesign'
import { authedFetch } from '../composables/useAuth'

export interface BookSummary {
  id: string
  name: string
  updatedAt: string
  lessonCount: number
}

export interface BookRecord {
  id: string
  name: string
  updatedAt: string
  data: TeachingBook
}

export interface BookMeta {
  id: string
  name: string
  updatedAt: string
}

export interface GenerateResult {
  filename: string
  markdown: string
}

export function listBooks(): Promise<BookSummary[]> {
  return authedFetch('/api/books')
}

export function createBook(name: string): Promise<BookRecord> {
  return authedFetch('/api/books', { method: 'POST', body: JSON.stringify({ name }) })
}

export function getBook(id: string): Promise<BookRecord> {
  return authedFetch(`/api/books/${id}`)
}

export function updateBook(id: string, data: TeachingBook): Promise<BookMeta> {
  return authedFetch(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify({ data }) })
}

export function renameBook(id: string, name: string): Promise<BookMeta> {
  return authedFetch(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function deleteBook(id: string): Promise<{ ok: true }> {
  return authedFetch(`/api/books/${id}`, { method: 'DELETE' })
}

export function generateLesson(topic: string): Promise<GenerateResult> {
  return authedFetch('/api/generate', { method: 'POST', body: JSON.stringify({ topic }) })
}

export function generateOutline(theme: string): Promise<{ titles: string[] }> {
  return authedFetch('/api/generate/outline', { method: 'POST', body: JSON.stringify({ theme }) })
}
```

- [ ] **Step 2: Run frontend tests to catch type regressions**

```bash
npm run test
```

Expected: all existing tests pass. (booksApi.ts tests mock fetch globally, so they may need updating — see note below.)

> **Note:** `src/services/booksApi.test.ts` mocks `fetch` globally. After this change, `authedFetch` is called instead of the local `request` helper. The tests should still pass because `authedFetch` also calls `fetch` internally. If they fail with "Cannot read properties of undefined", check that the mock returns `{ ok: true, json: ... }` correctly.

- [ ] **Step 3: Commit**

```bash
git add src/services/booksApi.ts
git commit -m "feat: use authedFetch in booksApi for auth-aware requests"
```

---

## Task 9: Create src/components/LoginPage.vue

**Files:**
- Create: `src/components/LoginPage.vue`

- [ ] **Step 1: Create src/components/LoginPage.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{ success: [] }>()

const { login } = useAuth()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit(): Promise<void> {
  if (!username.value.trim() || !password.value) return
  error.value = ''
  loading.value = true
  try {
    await login(username.value.trim(), password.value)
    emit('success')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <form class="login-form" @submit.prevent="handleSubmit">
      <h1>教学设计</h1>
      <div class="field">
        <label for="username">用户名</label>
        <input
          id="username"
          v-model="username"
          type="text"
          autocomplete="username"
          :disabled="loading"
        />
      </div>
      <div class="field">
        <label for="password">密码</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          :disabled="loading"
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading || !username || !password">
        {{ loading ? '登录中…' : '登录' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.login-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-form h1 {
  margin: 0;
  font-size: 1.5rem;
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field label {
  font-size: 0.875rem;
  color: #555;
}

.field input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.field input:disabled {
  background: #f5f5f5;
}

.error {
  color: #c0392b;
  font-size: 0.875rem;
  margin: 0;
}

button[type='submit'] {
  padding: 0.6rem;
  background: #2c3e50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}

button[type='submit']:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LoginPage.vue
git commit -m "feat: add LoginPage component"
```

---

## Task 10: Update src/App.vue with login gate and admin navigation

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Replace src/App.vue**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminPage from './components/AdminPage.vue'
import BookListPage from './components/BookListPage.vue'
import LoginPage from './components/LoginPage.vue'
import WorkspaceView from './components/WorkspaceView.vue'
import { useAuth } from './composables/useAuth'

const { isLoggedIn, fetchMe } = useAuth()
const currentBookId = ref<string | null>(null)
const showAdmin = ref(false)

onMounted(async () => {
  await fetchMe()
})

function openBook(id: string): void {
  currentBookId.value = id
  showAdmin.value = false
}

function backToList(): void {
  currentBookId.value = null
}

function openAdmin(): void {
  showAdmin.value = true
  currentBookId.value = null
}

function closeAdmin(): void {
  showAdmin.value = false
}
</script>

<template>
  <LoginPage v-if="!isLoggedIn" @success="fetchMe" />
  <template v-else>
    <AdminPage v-if="showAdmin" @back="closeAdmin" />
    <WorkspaceView
      v-else-if="currentBookId"
      :key="currentBookId"
      :book-id="currentBookId"
      @back="backToList"
    />
    <BookListPage v-else @open="openBook" @admin="openAdmin" />
  </template>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat: add login gate and admin navigation to App.vue"
```

---

## Task 11: Create src/components/AdminPage.vue + add admin button to BookListPage

**Files:**
- Create: `src/components/AdminPage.vue`
- Modify: `src/components/BookListPage.vue`

- [ ] **Step 1: Create src/components/AdminPage.vue**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authedFetch } from '../composables/useAuth'
import { authedFetch, useAuth } from '../composables/useAuth'
import type { UserSummary } from '../composables/useAuth'

const emit = defineEmits<{ back: [] }>()

const { logout } = useAuth()
const users = ref<UserSummary[]>([])
const newUsername = ref('')
const newPassword = ref('')
const newRole = ref<'user' | 'admin'>('user')
const error = ref('')
const loading = ref(false)

async function loadUsers(): Promise<void> {
  users.value = await authedFetch<UserSummary[]>('/api/admin/users')
}

async function createUser(): Promise<void> {
  if (!newUsername.value.trim() || !newPassword.value) return
  error.value = ''
  loading.value = true
  try {
    await authedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        username: newUsername.value.trim(),
        password: newPassword.value,
        role: newRole.value,
      }),
    })
    newUsername.value = ''
    newPassword.value = ''
    newRole.value = 'user'
    await loadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    loading.value = false
  }
}

async function removeUser(id: string): Promise<void> {
  if (!confirm('确定要删除该用户吗？')) return
  try {
    await authedFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    await loadUsers()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

async function handleLogout(): Promise<void> {
  await logout()
}

onMounted(loadUsers)
</script>

<template>
  <div class="admin-page">
    <header>
      <button @click="emit('back')">← 返回</button>
      <h1>用户管理</h1>
      <button @click="handleLogout">退出登录</button>
    </header>

    <section class="create-user">
      <h2>新建用户</h2>
      <form @submit.prevent="createUser">
        <input v-model="newUsername" placeholder="用户名" :disabled="loading" />
        <input v-model="newPassword" type="password" placeholder="密码" :disabled="loading" />
        <select v-model="newRole" :disabled="loading">
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
        <button type="submit" :disabled="loading || !newUsername || !newPassword">创建</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section class="user-list">
      <h2>所有用户</h2>
      <table>
        <thead>
          <tr>
            <th>用户名</th>
            <th>角色</th>
            <th>创建时间</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td>
            <td>{{ u.role === 'admin' ? '管理员' : '普通用户' }}</td>
            <td>{{ new Date(u.createdAt).toLocaleDateString('zh-CN') }}</td>
            <td>
              <button @click="removeUser(u.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  padding: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

header h1 {
  flex: 1;
  margin: 0;
}

.create-user form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.create-user input,
.create-user select {
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error {
  color: #c0392b;
  font-size: 0.875rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
}

th, td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

th {
  font-weight: 600;
  color: #555;
}

button {
  padding: 0.3rem 0.7rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
}

button:hover {
  background: #f5f5f5;
}
</style>
```

- [ ] **Step 2: Add admin button to BookListPage.vue**

Find the header/toolbar area of `src/components/BookListPage.vue` and add an admin button that only shows for admin users. The exact location depends on the existing template. Add the following at the top of the `<script setup>`:

```ts
import { useAuth } from '../composables/useAuth'

const { user, logout } = useAuth()
const emit = defineEmits<{ open: [id: string]; admin: [] }>()
```

(If `emit` is already defined, just add `admin: []` to its type and add the `useAuth` import.)

Then in the template header area, add:

```html
<button v-if="user?.role === 'admin'" @click="emit('admin')">用户管理</button>
<button @click="logout">退出登录</button>
```

> **Note:** Read `BookListPage.vue` first to find the exact location of the existing header/toolbar, then insert the buttons in the appropriate place.

- [ ] **Step 3: Run all tests**

```bash
npm run test && bun test server
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminPage.vue src/components/BookListPage.vue
git commit -m "feat: add AdminPage and admin button in BookListPage"
```

---

## Task 12: Verify end-to-end in browser

**Files:** none

- [ ] **Step 1: Start dev server and backend**

Terminal 1:
```bash
npm run dev
```

Terminal 2:
```bash
bun run server:dev
```

- [ ] **Step 2: Verify login gate**

Open `http://localhost:5173`. Confirm the app shows the login form, not the book list.

- [ ] **Step 3: Verify login flow**

Log in with the admin credentials from `.env`. Confirm the book list appears.

- [ ] **Step 4: Verify protected API**

Without logging in (open an incognito window), try to access `http://localhost:5173`. Confirm login form is shown and `GET /api/books` returns 401.

- [ ] **Step 5: Verify admin panel**

Log in as admin. Click "用户管理". Create a new user. Log out. Log in as the new user. Confirm the new user can see books but the "用户管理" button is not visible.

- [ ] **Step 6: Verify token refresh**

After logging in, wait 15+ minutes (or set the system clock forward). Perform an action (e.g., rename a book). Confirm it succeeds via automatic token refresh.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete auth system — login gate, JWT tokens, admin panel"
```
