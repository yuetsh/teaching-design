# Admin Reset Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-management action that resets an existing user's password to the fixed temporary password `123456`.

**Architecture:** Add database helpers for updating password hashes and clearing refresh tokens, expose them through a protected admin route, then call that route from `AdminPage.vue`. The frontend sends no password body; the backend owns the fixed reset password and hashing.

**Tech Stack:** Bun, Hono, bun:sqlite, Vue 3, Vitest, Vue Test Utils.

---

## File Structure

- Modify `server/db.ts`: add `updateUserPasswordHash()` and `deleteRefreshTokensForUser()` helpers.
- Modify `server/db.test.ts`: cover password-hash updates and user refresh-token cleanup.
- Modify `server/routes/admin.ts`: add `POST /users/:id/reset-password`.
- Modify `server/routes/admin.test.ts`: cover successful reset, fixed-password verification, target refresh-token cleanup, missing user, and non-admin rejection.
- Modify `src/components/AdminPage.vue`: add reset-password button, confirmation flow, success message, and API call.
- Modify `src/components/AdminPage.test.ts`: cover reset button styling, confirm/cancel behavior, endpoint call, and success message.

### Task 1: Database Helpers

**Files:**
- Modify: `server/db.test.ts`
- Modify: `server/db.ts`

- [ ] **Step 1: Write failing DB helper tests**

In `server/db.test.ts`, update the imports from `./db` to include `updateUserPasswordHash` and `deleteRefreshTokensForUser`:

```ts
import {
  createBook, deleteBook, getBook, listBooks, openDb, renameBook, saveBookData,
  createUser, findUserByUsername, findUserById, listUsers, deleteUser, updateUserPasswordHash,
  createRefreshToken, findRefreshTokenByHash, deleteRefreshTokenByHash, deleteRefreshTokensForUser,
} from './db'
```

Append these tests inside `describe('users and refresh tokens', () => { ... })`:

```ts
  it('updates a user password hash', () => {
    const db = openDb(':memory:')
    const user = createUser(db, { username: 'frank', passwordHash: 'old-hash', role: 'user' })

    expect(updateUserPasswordHash(db, user.id, 'new-hash')).toBe(true)
    expect(findUserById(db, user.id)?.passwordHash).toBe('new-hash')
  })

  it('returns false when updating password hash for missing user', () => {
    const db = openDb(':memory:')
    expect(updateUserPasswordHash(db, 'missing', 'new-hash')).toBe(false)
  })

  it('deletes refresh tokens for one user', () => {
    const db = openDb(':memory:')
    const first = createUser(db, { username: 'grace', passwordHash: 'h', role: 'user' })
    const second = createUser(db, { username: 'heidi', passwordHash: 'h', role: 'user' })
    createRefreshToken(db, { userId: first.id, tokenHash: 'first-token', expiresAt: '2099-01-01T00:00:00.000Z' })
    createRefreshToken(db, { userId: second.id, tokenHash: 'second-token', expiresAt: '2099-01-01T00:00:00.000Z' })

    expect(deleteRefreshTokensForUser(db, first.id)).toBe(1)
    expect(findRefreshTokenByHash(db, 'first-token')).toBeNull()
    expect(findRefreshTokenByHash(db, 'second-token')).not.toBeNull()
  })
```

- [ ] **Step 2: Run DB tests to verify failure**

Run:

```bash
rtk bun test server/db.test.ts
```

Expected: FAIL because `updateUserPasswordHash` and `deleteRefreshTokensForUser` are not exported from `server/db.ts`.

- [ ] **Step 3: Implement DB helpers**

In `server/db.ts`, add this function after `deleteUser()`:

```ts
export function updateUserPasswordHash(db: Database, id: string, passwordHash: string): boolean {
  const result = db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id])
  return result.changes > 0
}
```

Add this function after `deleteRefreshTokenByHash()`:

```ts
export function deleteRefreshTokensForUser(db: Database, userId: string): number {
  const result = db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId])
  return result.changes
}
```

- [ ] **Step 4: Run DB tests to verify pass**

Run:

```bash
rtk bun test server/db.test.ts
```

Expected: PASS.

### Task 2: Admin Reset Password Route

**Files:**
- Modify: `server/routes/admin.test.ts`
- Modify: `server/routes/admin.ts`

- [ ] **Step 1: Write failing admin route tests**

In `server/routes/admin.test.ts`, update imports:

```ts
import { hashPassword, signAccessToken, verifyPassword } from '../auth'
import { createRefreshToken, createUser, findRefreshTokenByHash, findUserById, openDb } from '../db'
```

Append these tests inside `describe('admin routes', () => { ... })`:

```ts
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
```

- [ ] **Step 2: Run admin route tests to verify failure**

Run:

```bash
rtk bun test server/routes/admin.test.ts
```

Expected: FAIL with `404` or route-not-found behavior for `/reset-password`.

- [ ] **Step 3: Implement route**

In `server/routes/admin.ts`, update imports:

```ts
import { createUser, deleteRefreshTokensForUser, deleteUser, findUserById, listUsers, updateUserPasswordHash } from '../db'
```

Add this constant below the imports:

```ts
const RESET_PASSWORD = '123456'
```

Add this route before `app.delete('/users/:id', ...)`:

```ts
  app.post('/users/:id/reset-password', async (c) => {
    const targetId = c.req.param('id')
    if (!findUserById(db, targetId)) {
      return c.json({ error: '用户不存在' }, 404)
    }

    const passwordHash = await hashPassword(RESET_PASSWORD)
    updateUserPasswordHash(db, targetId, passwordHash)
    deleteRefreshTokensForUser(db, targetId)
    return c.json({ ok: true })
  })
```

- [ ] **Step 4: Run admin route tests to verify pass**

Run:

```bash
rtk bun test server/routes/admin.test.ts
```

Expected: PASS.

### Task 3: AdminPage Reset Action

**Files:**
- Modify: `src/components/AdminPage.test.ts`
- Modify: `src/components/AdminPage.vue`

- [ ] **Step 1: Write failing frontend tests**

In `src/components/AdminPage.test.ts`, update the import line:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
```

Update `beforeEach()` so one-shot mock responses from reset tests cannot leak into later tests:

```ts
  beforeEach(() => {
    authedFetch.mockReset()
    logout.mockReset()
    authedFetch.mockResolvedValue([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })
```

Append these tests inside `describe('AdminPage', () => { ... })`:

```ts
  it('resets a user password after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    authedFetch.mockResolvedValueOnce([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
    authedFetch.mockResolvedValueOnce({ ok: true })

    const wrapper = mount(AdminPage)
    await flushPromises()

    await wrapper.get('button[data-testid="reset-password-u1"]').trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalledWith('确定要将该用户密码重置为 123456 吗？')
    expect(authedFetch).toHaveBeenCalledWith('/api/admin/users/u1/reset-password', { method: 'POST' })
    expect(wrapper.text()).toContain('已将密码重置为 123456。')
  })

  it('does not reset a password when confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    authedFetch.mockResolvedValueOnce([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])

    const wrapper = mount(AdminPage)
    await flushPromises()

    await wrapper.get('button[data-testid="reset-password-u1"]').trigger('click')
    await flushPromises()

    expect(authedFetch).toHaveBeenCalledTimes(1)
  })
```

Update the existing `uses shared app control classes` test to assert the reset button style:

```ts
    expect(wrapper.get('button[data-testid="reset-password-u1"]').classes()).toContain('ui-button')
```

- [ ] **Step 2: Run AdminPage tests to verify failure**

Run:

```bash
rtk npm run test -- src/components/AdminPage.test.ts
```

Expected: FAIL because the reset-password button and success message do not exist yet.

- [ ] **Step 3: Add reset state and handler**

In `src/components/AdminPage.vue`, add this ref near the existing `error` ref:

```ts
const success = ref('')
```

In `createUser()`, add `success.value = ''` immediately after `error.value = ''`.

Add this function after `removeUser()`:

```ts
async function resetPassword(id: string): Promise<void> {
  if (!confirm('确定要将该用户密码重置为 123456 吗？')) return
  error.value = ''
  success.value = ''
  try {
    await authedFetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' })
    success.value = '已将密码重置为 123456。'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '重置失败'
  }
}
```

- [ ] **Step 4: Add UI controls**

In `src/components/AdminPage.vue`, after the error paragraph in the create-user section, add:

```vue
      <p v-if="success" class="ui-success">{{ success }}</p>
```

In each user table row, add the reset button before the delete button:

```vue
              <button
                class="ui-button"
                type="button"
                :data-testid="`reset-password-${u.id}`"
                @click="resetPassword(u.id)"
              >
                重置密码
              </button>
```

- [ ] **Step 5: Add success style**

In `src/style.css`, add this rule after `.ui-error`:

```css
.ui-success {
  color: var(--green-700);
  font-size: 14px;
  margin: 8px 0 0;
}
```

- [ ] **Step 6: Run AdminPage tests to verify pass**

Run:

```bash
rtk npm run test -- src/components/AdminPage.test.ts
```

Expected: PASS.

### Task 4: Full Verification and Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run frontend tests**

Run:

```bash
rtk npm run test
```

Expected: PASS.

- [ ] **Step 2: Run backend tests**

Run:

```bash
rtk npm run test:server
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
rtk npm run build
```

Expected: PASS.

- [ ] **Step 4: Review diff**

Run:

```bash
rtk git diff -- server/db.ts server/db.test.ts server/routes/admin.ts server/routes/admin.test.ts src/components/AdminPage.vue src/components/AdminPage.test.ts src/style.css
```

Expected: Diff contains only reset-password helpers, route, AdminPage UI, tests, and `.ui-success`.

- [ ] **Step 5: Commit implementation**

Run:

```bash
rtk git add server/db.ts server/db.test.ts server/routes/admin.ts server/routes/admin.test.ts src/components/AdminPage.vue src/components/AdminPage.test.ts src/style.css
rtk git commit -m "feat: add admin password reset"
```

Expected: Commit succeeds.
