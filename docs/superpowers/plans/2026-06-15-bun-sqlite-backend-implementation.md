# Bun + SQLite 后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为教学设计生成器新增 Bun + Hono + `bun:sqlite` 后端，支持多本「整本」的增删改查与持久化，并新增「输入主题生成教案」（Deepseek）功能；前端从 `localStorage` 切换为服务器 API，新增整本列表页与生成教案对话框。

**Architecture:** `server/` 目录下用 Hono 路由 + `bun:sqlite` 提供 `/api/books*` 与 `/api/generate` REST API，数据以 JSON 形式存入单表 `books`。前端新增 `booksApi.ts` 封装 fetch 调用，`useTeachingBook` 改为按 `bookId` 加载/保存；`App.vue` 拆分为 `BookListPage.vue`（入口列表）与 `WorkspaceView.vue`（原工作区，新增「生成教案」「返回列表」）。

**Tech Stack:** Bun 1.3、Hono 4、`bun:sqlite`、Vue 3 + TypeScript + Vite（不变）、Vitest、`bun:test`

参考设计文档：[2026-06-15-bun-sqlite-backend-design.md](../specs/2026-06-15-bun-sqlite-backend-design.md)

---

## File Structure

新增文件：

- `server/db.ts` — SQLite 初始化与整本 CRUD 数据访问函数
- `server/db.test.ts`
- `server/routes/books.ts` — `/api/books*` Hono 路由
- `server/routes/books.test.ts`
- `server/routes/generate.ts` — `/api/generate` Hono 路由（Deepseek）
- `server/routes/generate.test.ts`
- `server/index.ts` — Hono 应用入口（API + 静态文件回退）
- `src/services/booksApi.ts` — 前端 API 客户端
- `src/services/booksApi.test.ts`
- `src/components/GenerateLessonDialog.vue` — 生成教案对话框
- `src/components/GenerateLessonDialog.test.ts`
- `src/components/BookListPage.vue` — 整本列表入口页
- `src/components/BookListPage.test.ts`
- `src/components/WorkspaceToolbar.test.ts`
- `src/components/WorkspaceView.vue` — 原工作区（从 `App.vue` 拆出）
- `src/components/WorkspaceView.test.ts`

修改文件：

- `package.json` — 新增 `hono` 依赖与 `server`/`server:dev`/`test:server` 脚本
- `.gitignore` — 忽略 `data/teaching-books.db` 与 `.env`
- `vite.config.ts` — 新增 `/api` 开发代理
- `src/composables/useTeachingBook.ts` — 改为按 `bookId` 加载/保存，新增 `generateLesson`
- `src/composables/useTeachingBook.test.ts` — 改为 mock `booksApi`
- `src/components/WorkspaceToolbar.vue` — 新增「生成教案」「返回列表」按钮
- `src/App.vue` — 在 `BookListPage` 与 `WorkspaceView` 间切换
- `src/App.test.ts` — 改为校验整本列表入口
- `src/style.css` — 新增整本列表页样式

删除文件：

- `src/services/bookStorage.ts`
- `src/services/bookStorage.test.ts`
- `src/components/RestoreDraftDialog.vue`

---

## Task 1: 后端基础设施（依赖、脚本、代理）

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `vite.config.ts`

- [ ] **Step 1: 添加 Hono 依赖**

```bash
bun add hono
```

Expected: `package.json` 的 `dependencies` 中新增一行 `"hono": "^4.x.x"`（版本号以实际安装结果为准），`bun.lock`/`package-lock.json` 更新。

- [ ] **Step 2: 新增后端脚本**

在 `package.json` 的 `"scripts"` 中添加（保持已有脚本不变，仅新增以下三行）：

```json
    "server": "bun run server/index.ts",
    "server:dev": "bun --watch run server/index.ts",
    "test:server": "bun test server"
```

- [ ] **Step 3: 更新 `.gitignore`**

在文件末尾追加：

```gitignore
# Backend data and secrets
data/teaching-books.db
.env
```

- [ ] **Step 4: 新增 Vite 开发代理**

编辑 `vite.config.ts`，在 `defineConfig` 中新增 `server.proxy`：

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json bun.lock .gitignore vite.config.ts
git commit -m "chore: add Hono dependency, server scripts, and dev proxy"
```

(若 `bun add` 未生成 `bun.lock`，则省略该文件；只提交实际变更的锁文件。)

---

## Task 2: 数据库访问层 `server/db.ts`

**Files:**
- Create: `server/db.ts`
- Test: `server/db.test.ts`

- [ ] **Step 1: 写测试**

创建 `server/db.test.ts`：

```ts
import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { createEmptyBook, createEmptyTeachingDesign } from '../src/domain/teachingDesign'
import { createBook, deleteBook, getBook, listBooks, openDb, renameBook, saveBookData } from './db'

afterEach(() => {
  setSystemTime()
})

describe('db', () => {
  it('creates a book with empty data', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')

    expect(created.name).toBe('示例整本')
    expect(created.data.designs).toEqual([])
    expect(created.data.schemaVersion).toBe(1)
  })

  it('retrieves a created book by id', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')

    expect(getBook(db, created.id)).toEqual(created)
  })

  it('returns null for a missing book', () => {
    const db = openDb(':memory:')
    expect(getBook(db, 'missing')).toBeNull()
  })

  it('lists books ordered by most recently updated, with lesson counts', () => {
    const db = openDb(':memory:')
    setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const first = createBook(db, '第一本')
    setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
    const second = createBook(db, '第二本')

    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    setSystemTime(new Date('2026-01-03T00:00:00.000Z'))
    saveBookData(db, first.id, data)

    const books = listBooks(db)

    expect(books.map((book) => book.id)).toEqual([first.id, second.id])
    expect(books[0]?.lessonCount).toBe(1)
    expect(books[1]?.lessonCount).toBe(0)
  })

  it('saves book data and updates updated_at', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')
    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'

    setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    const result = saveBookData(db, created.id, data)

    expect(result).toEqual({ id: created.id, name: '示例整本', updatedAt: '2026-02-01T00:00:00.000Z' })
    expect(getBook(db, created.id)?.data.cover.courseName).toBe('Web 前端开发')
  })

  it('returns null when saving data for a missing book', () => {
    const db = openDb(':memory:')
    expect(saveBookData(db, 'missing', createEmptyBook())).toBeNull()
  })

  it('renames a book without changing updated_at', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '旧名称')

    const result = renameBook(db, created.id, '新名称')

    expect(result).toEqual({ id: created.id, name: '新名称', updatedAt: created.updatedAt })
    expect(getBook(db, created.id)?.name).toBe('新名称')
  })

  it('returns null when renaming a missing book', () => {
    const db = openDb(':memory:')
    expect(renameBook(db, 'missing', '新名称')).toBeNull()
  })

  it('deletes a book', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')

    expect(deleteBook(db, created.id)).toBe(true)
    expect(getBook(db, created.id)).toBeNull()
  })

  it('returns false when deleting a missing book', () => {
    const db = openDb(':memory:')
    expect(deleteBook(db, 'missing')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `bun test server/db.test.ts`
Expected: FAIL — `Cannot find module './db'`（`server/db.ts` 尚不存在）

- [ ] **Step 3: 实现 `server/db.ts`**

```ts
import { Database } from 'bun:sqlite'
import { createEmptyBook, type TeachingBook } from '../src/domain/teachingDesign'

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

interface BookRow {
  id: string
  name: string
  data: string
  updated_at: string
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

export function openDb(path: string): Database {
  const db = new Database(path)
  db.run(SCHEMA)
  return db
}

export function listBooks(db: Database): BookSummary[] {
  const rows = db
    .query<BookRow, []>('SELECT id, name, data, updated_at FROM books ORDER BY updated_at DESC')
    .all()

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    lessonCount: (JSON.parse(row.data) as TeachingBook).designs.length,
  }))
}

export function createBook(db: Database, name: string): BookRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const data = createEmptyBook()
  data.updatedAt = now

  db.run('INSERT INTO books (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    name,
    JSON.stringify(data),
    now,
    now,
  ])

  return { id, name, updatedAt: now, data }
}

export function getBook(db: Database, id: string): BookRecord | null {
  const row = db
    .query<BookRow, [string]>('SELECT id, name, data, updated_at FROM books WHERE id = ?')
    .get(id)
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    data: JSON.parse(row.data) as TeachingBook,
  }
}

export function saveBookData(db: Database, id: string, data: TeachingBook): BookMeta | null {
  const existing = db
    .query<{ name: string }, [string]>('SELECT name FROM books WHERE id = ?')
    .get(id)
  if (!existing) return null

  const now = new Date().toISOString()
  db.run('UPDATE books SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify(data), now, id])

  return { id, name: existing.name, updatedAt: now }
}

export function renameBook(db: Database, id: string, name: string): BookMeta | null {
  const existing = db
    .query<{ updated_at: string }, [string]>('SELECT updated_at FROM books WHERE id = ?')
    .get(id)
  if (!existing) return null

  db.run('UPDATE books SET name = ? WHERE id = ?', [name, id])

  return { id, name, updatedAt: existing.updated_at }
}

export function deleteBook(db: Database, id: string): boolean {
  const result = db.run('DELETE FROM books WHERE id = ?', [id])
  return result.changes > 0
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `bun test server/db.test.ts`
Expected: PASS — 10 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add server/db.ts server/db.test.ts
git commit -m "feat: add SQLite-backed book data access layer"
```

---

## Task 3: 整本 CRUD 路由 `server/routes/books.ts`

**Files:**
- Create: `server/routes/books.ts`
- Test: `server/routes/books.test.ts`

- [ ] **Step 1: 写测试**

创建 `server/routes/books.test.ts`：

```ts
import { beforeEach, describe, expect, it } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { createEmptyBook } from '../../src/domain/teachingDesign'
import { openDb } from '../db'
import { createBooksRouter } from './books'

describe('books routes', () => {
  let app: Hono
  let db: Database

  beforeEach(() => {
    db = openDb(':memory:')
    app = new Hono().route('/api/books', createBooksRouter(db))
  })

  async function createViaApi(name: string): Promise<{ id: string }> {
    const res = await app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    return (await res.json()) as { id: string }
  }

  it('lists no books initially', async () => {
    const res = await app.request('/api/books')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('creates a book', async () => {
    const res = await app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '示例整本' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { name: string; data: { designs: unknown[] } }
    expect(body.name).toBe('示例整本')
    expect(body.data.designs).toEqual([])
  })

  it('returns 400 when creating without a name', async () => {
    const res = await app.request('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('gets a created book', async () => {
    const created = await createViaApi('示例整本')

    const res = await app.request(`/api/books/${created.id}`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { id: string }).id).toBe(created.id)
  })

  it('returns 404 for a missing book', async () => {
    const res = await app.request('/api/books/missing')
    expect(res.status).toBe(404)
  })

  it('saves book data', async () => {
    const created = await createViaApi('示例整本')

    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    expect(res.status).toBe(200)

    const fetched = await app.request(`/api/books/${created.id}`)
    const body = (await fetched.json()) as { data: { cover: { courseName: string } } }
    expect(body.data.cover.courseName).toBe('Web 前端开发')
  })

  it('returns 404 when saving data for a missing book', async () => {
    const res = await app.request('/api/books/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: createEmptyBook() }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when saving without data', async () => {
    const created = await createViaApi('示例整本')

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('renames a book', async () => {
    const created = await createViaApi('旧名称')

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名称' }),
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { name: string }).name).toBe('新名称')
  })

  it('returns 404 when renaming a missing book', async () => {
    const res = await app.request('/api/books/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名称' }),
    })
    expect(res.status).toBe(404)
  })

  it('deletes a book', async () => {
    const created = await createViaApi('示例整本')

    const res = await app.request(`/api/books/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect((await app.request(`/api/books/${created.id}`)).status).toBe(404)
  })

  it('returns 404 when deleting a missing book', async () => {
    const res = await app.request('/api/books/missing', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `bun test server/routes/books.test.ts`
Expected: FAIL — `Cannot find module './books'`（`server/routes/books.ts` 尚不存在）

- [ ] **Step 3: 实现 `server/routes/books.ts`**

```ts
import type { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import type { TeachingBook } from '../../src/domain/teachingDesign'
import { createBook, deleteBook, getBook, listBooks, renameBook, saveBookData } from '../db'

export function createBooksRouter(db: Database): Hono {
  const app = new Hono()

  app.get('/', (c) => {
    return c.json(listBooks(db))
  })

  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null
    const name = body?.name

    if (typeof name !== 'string' || name.trim() === '') {
      return c.json({ error: '请提供整本名称。' }, 400)
    }

    return c.json(createBook(db, name.trim()))
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `bun test server/routes/books.test.ts`
Expected: PASS — 12 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add server/routes/books.ts server/routes/books.test.ts
git commit -m "feat: add CRUD routes for teaching design books"
```

---

## Task 4: AI 生成路由 `server/routes/generate.ts`

**Files:**
- Create: `server/routes/generate.ts`
- Test: `server/routes/generate.test.ts`

- [ ] **Step 1: 写测试**

创建 `server/routes/generate.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { createGenerateRouter } from './generate'

describe('generate route', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns 400 when topic is missing', async () => {
    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))

    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 500 when DEEPSEEK_API_KEY is not configured', async () => {
    const app = new Hono().route('/api/generate', createGenerateRouter(undefined))

    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(500)
  })

  it('returns parsed markdown on success', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '# CSS 弹性布局 教学设计' } }] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { filename: string; markdown: string }
    expect(body.filename).toBe('CSS 弹性布局.md')
    expect(body.markdown).toContain('# CSS 弹性布局 教学设计')
  })

  it('returns 502 when Deepseek responds with an error status', async () => {
    globalThis.fetch = mock(async () => new Response('', { status: 401 })) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(502)
  })

  it('returns 502 when fetch throws', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network error')
    }) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(502)
  })

  it('returns 502 when Deepseek response has no content', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })) as unknown as typeof fetch

    const app = new Hono().route('/api/generate', createGenerateRouter('test-key'))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'CSS 弹性布局' }),
    })

    expect(res.status).toBe(502)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `bun test server/routes/generate.test.ts`
Expected: FAIL — `Cannot find module './generate'`（`server/routes/generate.ts` 尚不存在）

- [ ] **Step 3: 实现 `server/routes/generate.ts`**

```ts
import { Hono } from 'hono'

const SYSTEM_PROMPT = `你是一名教学设计专家，需要根据用户提供的主题生成一份 Markdown 格式的教案。
请严格遵循以下结构（标题、表格列数、章节名称必须完全一致，便于程序解析），只输出 Markdown 正文本身，不要使用代码块包裹整篇文档，不要添加任何额外说明：

1. 第一行是一级标题：\`# <课程标题> 教学设计\`
2. 紧接着是一个两列表格（表头使用 \`|:---|:---|\`），依次包含以下行：
   - \`| **课题** | **<课题名称>** |\`
   - \`| **课时** | <课时说明，例如 1课时（40分钟）> |\`
   - \`| **教学目标** | **知识目标**：...<br>**技能目标**：...<br>**素养目标**：... |\`
   - \`| **教学重难点** | **重点**：...<br>**难点**：... |\`
   - \`| **教学资源准备** | ... |\`
3. 二级标题 \`## 教学过程\`，后接一个 5 列表格，表头固定为：
   \`| 教学环节 | 教学内容 | 教师活动 | 学生活动 | 设计意图 |\`，分隔行 \`|:---|:---|:---|:---|:---|\`，
   包含 4-6 个教学环节行，每个环节名称写作 \`**N. 环节名称**<br>（时长）\` 的格式。
4. 二级标题 \`## 板书设计\`，内容放在 \`\`\`text 代码块中。
5. 二级标题 \`## 教学成效与反思\`，后接一个两列表格：
   - \`| **教学成效** | ... |\`
   - \`| **教学反思** | ... |\`
`

function sanitizeFilename(topic: string): string {
  const sanitized = topic.trim().replace(/[\\/:*?"<>|]/g, '_')
  return sanitized || 'lesson'
}

export function createGenerateRouter(apiKey: string | undefined): Hono {
  const app = new Hono()

  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { topic?: unknown } | null
    const topic = body?.topic

    if (typeof topic !== 'string' || topic.trim() === '') {
      return c.json({ error: '请提供教案主题。' }, 400)
    }

    if (!apiKey) {
      return c.json({ error: '未配置 DEEPSEEK_API_KEY。' }, 500)
    }

    let response: Response
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `请围绕主题"${topic.trim()}"生成一份教案。` },
          ],
        }),
      })
    } catch {
      return c.json({ error: 'Deepseek 请求失败，请检查网络后重试。' }, 502)
    }

    if (!response.ok) {
      return c.json({ error: `Deepseek 请求失败（状态码 ${response.status}）。` }, 502)
    }

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null
    const markdown = payload?.choices?.[0]?.message?.content

    if (!markdown) {
      return c.json({ error: 'Deepseek 返回内容为空。' }, 502)
    }

    return c.json({ filename: `${sanitizeFilename(topic)}.md`, markdown })
  })

  return app
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `bun test server/routes/generate.test.ts`
Expected: PASS — 6 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add server/routes/generate.ts server/routes/generate.test.ts
git commit -m "feat: add Deepseek-backed lesson generation route"
```

---

## Task 5: 服务器入口 `server/index.ts`

**Files:**
- Create: `server/index.ts`

- [ ] **Step 1: 实现 `server/index.ts`**

```ts
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { openDb } from './db'
import { createBooksRouter } from './routes/books'
import { createGenerateRouter } from './routes/generate'

const db = openDb(process.env.TEACHING_BOOKS_DB ?? 'data/teaching-books.db')

const app = new Hono()

app.route('/api/books', createBooksRouter(db))
app.route('/api/generate', createGenerateRouter(process.env.DEEPSEEK_API_KEY))

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

export default {
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  fetch: app.fetch,
}
```

- [ ] **Step 2: 手动验证服务器可启动**

Run: `bun run server/index.ts`
Expected: 进程启动且无报错（终端无输出即表示监听成功；可按 Ctrl+C 退出）。再运行：

```bash
curl -s http://localhost:3001/api/books
```

Expected: 输出 `[]`（数据库首次创建，`data/teaching-books.db` 文件已生成）。

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: add Hono server entry point with static fallback"
```

---

## Task 6: 前端 API 客户端 `src/services/booksApi.ts`

**Files:**
- Create: `src/services/booksApi.ts`
- Test: `src/services/booksApi.test.ts`

- [ ] **Step 1: 写测试**

创建 `src/services/booksApi.test.ts`：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook } from '../domain/teachingDesign'
import * as booksApi from './booksApi'

describe('booksApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists books', async () => {
    const summaries = [{ id: 'b1', name: 'Web', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 2 }]
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(summaries), { status: 200 }))

    await expect(booksApi.listBooks()).resolves.toEqual(summaries)
    expect(fetch).toHaveBeenCalledWith('/api/books', expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('creates a book', async () => {
    const created = { id: 'b1', name: '新整本', updatedAt: '2026-01-01T00:00:00.000Z', data: createEmptyBook() }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(created), { status: 200 }))

    await expect(booksApi.createBook('新整本')).resolves.toEqual(created)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ name: '新整本' })
  })

  it('gets a book', async () => {
    const record = { id: 'b1', name: 'Web', updatedAt: '2026-01-01T00:00:00.000Z', data: createEmptyBook() }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(record), { status: 200 }))

    await expect(booksApi.getBook('b1')).resolves.toEqual(record)
    expect(fetch).toHaveBeenCalledWith('/api/books/b1', expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('updates a book', async () => {
    const meta = { id: 'b1', name: 'Web', updatedAt: '2026-01-02T00:00:00.000Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(meta), { status: 200 }))

    const data = createEmptyBook()
    await expect(booksApi.updateBook('b1', data)).resolves.toEqual(meta)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ data })
  })

  it('renames a book', async () => {
    const meta = { id: 'b1', name: '新名称', updatedAt: '2026-01-01T00:00:00.000Z' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(meta), { status: 200 }))

    await expect(booksApi.renameBook('b1', '新名称')).resolves.toEqual(meta)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ name: '新名称' })
  })

  it('deletes a book', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await expect(booksApi.deleteBook('b1')).resolves.toEqual({ ok: true })

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('DELETE')
  })

  it('generates a lesson', async () => {
    const result = { filename: 'css-flex.md', markdown: '# CSS 弹性布局 教学设计' }
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))

    await expect(booksApi.generateLesson('CSS 弹性布局')).resolves.toEqual(result)

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(JSON.parse(init?.body as string)).toEqual({ topic: 'CSS 弹性布局' })
  })

  it('throws the server error message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: '整本不存在。' }), { status: 404 }))

    await expect(booksApi.getBook('missing')).rejects.toThrow('整本不存在。')
  })

  it('throws a generic error when the response has no error message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }))

    await expect(booksApi.getBook('b1')).rejects.toThrow('请求失败（500）')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/services/booksApi.test.ts`
Expected: FAIL — `Failed to resolve import "./booksApi"`（`src/services/booksApi.ts` 尚不存在）

- [ ] **Step 3: 实现 `src/services/booksApi.ts`**

```ts
import type { TeachingBook } from '../domain/teachingDesign'

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

interface ErrorBody {
  error?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null
    throw new Error(body?.error ?? `请求失败（${response.status}）。`)
  }

  return response.json() as Promise<T>
}

export function listBooks(): Promise<BookSummary[]> {
  return request('/api/books')
}

export function createBook(name: string): Promise<BookRecord> {
  return request('/api/books', { method: 'POST', body: JSON.stringify({ name }) })
}

export function getBook(id: string): Promise<BookRecord> {
  return request(`/api/books/${id}`)
}

export function updateBook(id: string, data: TeachingBook): Promise<BookMeta> {
  return request(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify({ data }) })
}

export function renameBook(id: string, name: string): Promise<BookMeta> {
  return request(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
}

export function deleteBook(id: string): Promise<{ ok: true }> {
  return request(`/api/books/${id}`, { method: 'DELETE' })
}

export function generateLesson(topic: string): Promise<GenerateResult> {
  return request('/api/generate', { method: 'POST', body: JSON.stringify({ topic }) })
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/services/booksApi.test.ts`
Expected: PASS — 9 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add src/services/booksApi.ts src/services/booksApi.test.ts
git commit -m "feat: add booksApi client for the books backend"
```

---

## Task 7: 重写 `useTeachingBook`（按 `bookId` 加载/保存 + 生成教案）

**Files:**
- Modify: `src/composables/useTeachingBook.ts`
- Test: `src/composables/useTeachingBook.test.ts`

- [ ] **Step 1: 重写测试**

替换 `src/composables/useTeachingBook.test.ts` 全部内容为：

```ts
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook, createEmptyTeachingDesign, type TeachingBook } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import { useTeachingBook } from './useTeachingBook'

vi.mock('../services/booksApi')

function mockGetBook(data: TeachingBook, id = 'b1'): void {
  vi.mocked(booksApi.getBook).mockResolvedValue({ id, name: '示例整本', updatedAt: data.updatedAt, data })
}

describe('useTeachingBook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('loads the book from the API', async () => {
    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    expect(booksApi.getBook).toHaveBeenCalledWith('b1')
    expect(store.loadStatus.value).toBe('loaded')
    expect(store.book.value.cover.courseName).toBe('Web 前端开发')
  })

  it('sets loadStatus to error when loading fails', async () => {
    vi.mocked(booksApi.getBook).mockRejectedValue(new Error('网络错误。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    expect(store.loadStatus.value).toBe('error')
    expect(store.loadError.value).toBe('网络错误。')
  })

  it('imports files in natural order and selects the first lesson', async () => {
    mockGetBook(createEmptyBook())
    const store = useTeachingBook('b1')
    await flushPromises()

    const files = [
      new File(['# 第十课 教学设计'], '10.md', { type: 'text/markdown' }),
      new File(['# 第二课 教学设计'], '2.md', { type: 'text/markdown' }),
    ]

    await store.importFiles(files, 'keep')

    expect(store.book.value.designs.map((design) => design.originalFilename)).toEqual(['2.md', '10.md'])
    expect(store.book.value.selectedId).toBe(store.book.value.designs[0]?.id)
  })

  it('reorders lessons without changing their identities', async () => {
    mockGetBook(createEmptyBook())
    const store = useTeachingBook('b1')
    await flushPromises()

    await store.importFiles(
      [new File(['# One 教学设计'], '1.md'), new File(['# Two 教学设计'], '2.md')],
      'keep',
    )

    const ids = store.book.value.designs.map((design) => design.id)
    store.moveDesign(0, 1)

    expect(store.book.value.designs.map((design) => design.id)).toEqual(ids.reverse())
  })

  it('does not autosave immediately after the initial load', async () => {
    mockGetBook(createEmptyBook())
    useTeachingBook('b1')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(300)

    expect(booksApi.updateBook).not.toHaveBeenCalled()
  })

  it('autosaves the book via the API after the debounce delay', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.updateBook).mockResolvedValue({ id: 'b1', name: '示例整本', updatedAt: 'later' })

    const store = useTeachingBook('b1')
    await flushPromises()

    store.updateCover({ courseName: '新课程名' })
    await vi.advanceTimersByTimeAsync(300)

    expect(booksApi.updateBook).toHaveBeenCalledWith('b1', store.book.value)
    expect(store.saveStatus.value).toBe('saved')
  })

  it('sets saveStatus to error when autosave fails', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.updateBook).mockRejectedValue(new Error('保存失败。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    store.updateCover({ courseName: '新课程名' })
    await vi.advanceTimersByTimeAsync(300)

    expect(store.saveStatus.value).toBe('error')
    expect(store.lastError.value).toBe('保存失败。')
  })

  it('generateLesson appends a parsed design and selects it', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.generateLesson).mockResolvedValue({
      filename: 'css-flex.md',
      markdown: '# CSS 弹性布局 教学设计',
    })

    const store = useTeachingBook('b1')
    await flushPromises()

    const result = await store.generateLesson('CSS 弹性布局')

    expect(result).toEqual({ ok: true })
    expect(store.book.value.designs).toHaveLength(1)
    expect(store.book.value.selectedId).toBe(store.book.value.designs[0]?.id)
  })

  it('generateLesson returns an error when the API call fails', async () => {
    mockGetBook(createEmptyBook())
    vi.mocked(booksApi.generateLesson).mockRejectedValue(new Error('Deepseek 请求失败。'))

    const store = useTeachingBook('b1')
    await flushPromises()

    const result = await store.generateLesson('CSS 弹性布局')

    expect(result).toEqual({ ok: false, message: 'Deepseek 请求失败。' })
    expect(store.book.value.designs).toHaveLength(0)
  })

  it('clearBook empties designs but keeps the cover', async () => {
    const data = createEmptyBook()
    data.cover.courseName = 'Web 前端开发'
    data.designs.push(createEmptyTeachingDesign('1.md'))
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    store.clearBook()

    expect(store.book.value.designs).toEqual([])
    expect(store.book.value.cover.courseName).toBe('Web 前端开发')
    expect(store.book.value.selectedId).toBe('cover')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/composables/useTeachingBook.test.ts`
Expected: FAIL — 现有 `useTeachingBook` 不接受参数、没有 `loadStatus`/`generateLesson` 等字段，多个断言失败。

- [ ] **Step 3: 重写 `src/composables/useTeachingBook.ts`**

替换全部内容为：

```ts
import { nextTick, ref, watch, type Ref } from 'vue'
import {
  createEmptyBook,
  type BookCover,
  type DesignId,
  type TeachingBook,
  type TeachingDesign,
} from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import { parseTeachingDesign } from '../services/markdownParser'
import { sortFilesNaturally } from '../services/naturalSort'

const AUTOSAVE_DELAY_MS = 300

export type DuplicateStrategy = 'replace' | 'keep'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type LoadStatus = 'loading' | 'loaded' | 'error'

export type GenerateLessonResult = { ok: true } | { ok: false; message: string }

export interface ImportResult {
  imported: number
  failed: Array<{ filename: string; message: string }>
  duplicates: string[]
}

export interface TeachingBookStore {
  book: Ref<TeachingBook>
  loadStatus: Ref<LoadStatus>
  loadError: Ref<string | null>
  saveStatus: Ref<SaveStatus>
  lastError: Ref<string | null>
  selectedDesign: Ref<TeachingDesign | null>
  hasDesigns: Ref<boolean>
  warningCount: Ref<number>
  importFiles: (files: readonly File[], strategy: DuplicateStrategy) => Promise<ImportResult>
  detectDuplicates: (files: readonly File[]) => string[]
  selectPage: (id: 'cover' | DesignId) => void
  moveDesign: (from: number, to: number) => void
  removeDesign: (id: DesignId) => void
  updateCover: (patch: Partial<BookCover>) => void
  updateDesign: (id: DesignId, updater: (design: TeachingDesign) => void) => void
  clearBook: () => void
  generateLesson: (topic: string) => Promise<GenerateLessonResult>
}

export function useTeachingBook(bookId: string): TeachingBookStore {
  const book = ref<TeachingBook>(createEmptyBook()) as Ref<TeachingBook>
  const loadStatus = ref<LoadStatus>('loading')
  const loadError = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('idle')
  const lastError = ref<string | null>(null)

  const selectedDesign = ref<TeachingDesign | null>(null)
  const hasDesigns = ref(false)
  const warningCount = ref(0)

  let isLoading = true
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined

  function syncDerived(): void {
    const current = book.value
    hasDesigns.value = current.designs.length > 0
    selectedDesign.value =
      current.selectedId === 'cover'
        ? null
        : current.designs.find((design) => design.id === current.selectedId) ?? null
    warningCount.value = current.designs.reduce(
      (total, design) => total + design.warnings.length,
      0,
    )
  }

  syncDerived()

  function touch(): void {
    book.value.updatedAt = new Date().toISOString()
  }

  function scheduleSave(): void {
    if (autosaveTimer !== undefined) {
      clearTimeout(autosaveTimer)
    }

    autosaveTimer = setTimeout(() => {
      saveStatus.value = 'saving'
      booksApi
        .updateBook(bookId, book.value)
        .then(() => {
          saveStatus.value = 'saved'
          lastError.value = null
        })
        .catch((error: unknown) => {
          saveStatus.value = 'error'
          lastError.value = error instanceof Error ? error.message : '保存失败。'
        })
    }, AUTOSAVE_DELAY_MS)
  }

  watch(
    book,
    () => {
      syncDerived()
      if (isLoading) return
      scheduleSave()
    },
    { deep: true },
  )

  async function load(): Promise<void> {
    try {
      const record = await booksApi.getBook(bookId)
      book.value = record.data
      await nextTick()
      loadStatus.value = 'loaded'
    } catch (error) {
      loadStatus.value = 'error'
      loadError.value = error instanceof Error ? error.message : '加载失败。'
    } finally {
      isLoading = false
    }
  }

  void load()

  function detectDuplicates(files: readonly File[]): string[] {
    const existingNames = new Set(book.value.designs.map((design) => design.originalFilename))
    return files.map((file) => file.name).filter((name) => existingNames.has(name))
  }

  async function importFiles(
    files: readonly File[],
    strategy: DuplicateStrategy,
  ): Promise<ImportResult> {
    const markdownFiles = files.filter((file) => /\.md$/i.test(file.name))
    const failed: ImportResult['failed'] = files
      .filter((file) => !/\.md$/i.test(file.name))
      .map((file) => ({ filename: file.name, message: '仅支持 .md 文件。' }))

    const sortedFiles = sortFilesNaturally([...markdownFiles])
    const duplicates: string[] = []
    let imported = 0

    for (const file of sortedFiles) {
      try {
        const text = await file.text()
        const design = parseTeachingDesign(file.name, text)

        const existingIndex = book.value.designs.findIndex(
          (existing) => existing.originalFilename === file.name,
        )

        if (existingIndex !== -1) {
          duplicates.push(file.name)
          if (strategy === 'replace') {
            book.value.designs.splice(existingIndex, 1, design)
          } else {
            book.value.designs.push(design)
          }
        } else {
          book.value.designs.push(design)
        }

        imported++
      } catch (error) {
        failed.push({
          filename: file.name,
          message: error instanceof Error ? error.message : '解析失败。',
        })
      }
    }

    if (imported > 0 && book.value.selectedId === 'cover' && book.value.designs.length > 0) {
      book.value.selectedId = book.value.designs[0]!.id
    }

    if (imported > 0) {
      touch()
    }

    return { imported, failed, duplicates }
  }

  function selectPage(id: 'cover' | DesignId): void {
    book.value.selectedId = id
  }

  function moveDesign(from: number, to: number): void {
    const designs = book.value.designs
    if (from < 0 || from >= designs.length || to < 0 || to >= designs.length) {
      return
    }
    const [moved] = designs.splice(from, 1)
    designs.splice(to, 0, moved!)
    touch()
  }

  function removeDesign(id: DesignId): void {
    const designs = book.value.designs
    const index = designs.findIndex((design) => design.id === id)
    if (index === -1) {
      return
    }
    designs.splice(index, 1)

    if (book.value.selectedId === id) {
      book.value.selectedId = designs[index]?.id ?? designs[index - 1]?.id ?? 'cover'
    }

    touch()
  }

  function updateCover(patch: Partial<BookCover>): void {
    Object.assign(book.value.cover, patch)
    touch()
  }

  function updateDesign(id: DesignId, updater: (design: TeachingDesign) => void): void {
    const design = book.value.designs.find((candidate) => candidate.id === id)
    if (!design) {
      return
    }
    updater(design)
    touch()
  }

  function clearBook(): void {
    book.value.designs = []
    book.value.selectedId = 'cover'
    touch()
  }

  async function generateLesson(topic: string): Promise<GenerateLessonResult> {
    try {
      const result = await booksApi.generateLesson(topic)
      const design = parseTeachingDesign(result.filename, result.markdown)
      book.value.designs.push(design)
      book.value.selectedId = design.id
      touch()
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '生成失败。' }
    }
  }

  return {
    book,
    loadStatus,
    loadError,
    saveStatus,
    lastError,
    selectedDesign,
    hasDesigns,
    warningCount,
    importFiles,
    detectDuplicates,
    selectPage,
    moveDesign,
    removeDesign,
    updateCover,
    updateDesign,
    clearBook,
    generateLesson,
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/composables/useTeachingBook.test.ts`
Expected: PASS — 11 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add src/composables/useTeachingBook.ts src/composables/useTeachingBook.test.ts
git commit -m "feat: load and autosave teaching books via booksApi"
```

> 注意：本步骤的 `clearBook()` 仅清空 `designs` 并将 `selectedId` 重置为 `'cover'`，**保留** `cover`（课程名称/教师姓名）。这与旧版 `clearBook()`（整体重置为 `createEmptyBook()`）行为不同，但更符合设计文档中「清空教案列表但保留整本记录」的描述。

---

## Task 8: 生成教案对话框 `GenerateLessonDialog.vue`

**Files:**
- Create: `src/components/GenerateLessonDialog.vue`
- Test: `src/components/GenerateLessonDialog.test.ts`

- [ ] **Step 1: 写测试**

创建 `src/components/GenerateLessonDialog.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GenerateLessonDialog from './GenerateLessonDialog.vue'

describe('GenerateLessonDialog', () => {
  it('disables submit until a topic is entered', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: null } })

    const submit = wrapper.findAll('button')[0]!
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('CSS 弹性布局')
    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('emits submit with the trimmed topic', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: null } })

    await wrapper.get('input').setValue('  CSS 弹性布局  ')
    await wrapper.findAll('button')[0]!.trigger('click')

    expect(wrapper.emitted('submit')).toEqual([['CSS 弹性布局']])
  })

  it('shows a loading state and disables interaction', () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: true, error: null } })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button')[0]!.text()).toContain('生成中')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeDefined()
  })

  it('shows an error message and allows retry without closing', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: 'Deepseek 请求失败。' } })

    expect(wrapper.text()).toContain('Deepseek 请求失败。')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeDefined()

    await wrapper.get('input').setValue('CSS 弹性布局')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeUndefined()
  })

  it('emits cancel', async () => {
    const wrapper = mount(GenerateLessonDialog, { props: { loading: false, error: null } })

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/GenerateLessonDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./GenerateLessonDialog.vue"`

- [ ] **Step 3: 实现 `src/components/GenerateLessonDialog.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [topic: string]
  cancel: []
}>()

const topic = ref('')

function submit(): void {
  const value = topic.value.trim()
  if (!value || props.loading) return
  emit('submit', value)
}
</script>

<template>
  <div class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="generate-lesson-title">
    <div class="dialog">
      <h2 id="generate-lesson-title">生成教案</h2>
      <p>输入主题，AI 将生成一份符合模板结构的教案，加入当前整本末尾。</p>
      <input
        v-model="topic"
        type="text"
        placeholder="例如：CSS 弹性布局入门"
        :disabled="loading"
        @keydown.enter="submit"
      />
      <p v-if="error" class="app-notice app-notice--error" role="alert">{{ error }}</p>
      <div class="dialog-actions">
        <button type="button" :disabled="loading || !topic.trim()" @click="submit">
          {{ loading ? '生成中…' : '生成' }}
        </button>
        <button type="button" :disabled="loading" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/GenerateLessonDialog.test.ts`
Expected: PASS — 5 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add src/components/GenerateLessonDialog.vue src/components/GenerateLessonDialog.test.ts
git commit -m "feat: add generate lesson dialog"
```

---

## Task 9: 更新 `WorkspaceToolbar.vue`（新增「生成教案」「返回列表」）

**Files:**
- Modify: `src/components/WorkspaceToolbar.vue`
- Test: `src/components/WorkspaceToolbar.test.ts`

- [ ] **Step 1: 写测试**

创建 `src/components/WorkspaceToolbar.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkspaceToolbar from './WorkspaceToolbar.vue'

function mountToolbar(lessonCount: number): ReturnType<typeof mount> {
  return mount(WorkspaceToolbar, {
    props: { lessonCount, warningCount: 0, saveStatus: 'idle' },
  })
}

describe('WorkspaceToolbar', () => {
  it('renders the lesson count', () => {
    const wrapper = mountToolbar(3)
    expect(wrapper.text()).toContain('共 3 课')
  })

  it('emits generate when the generate button is clicked', async () => {
    const wrapper = mountToolbar(3)
    await wrapper.get('button[data-testid="generate"]').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('emits back when the back button is clicked', async () => {
    const wrapper = mountToolbar(0)
    await wrapper.get('button[data-testid="back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('keeps generate and back enabled even with no lessons', () => {
    const wrapper = mountToolbar(0)
    expect(wrapper.get('button[data-testid="generate"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('button[data-testid="back"]').attributes('disabled')).toBeUndefined()
  })

  it('disables print, export and clear when there are no lessons', () => {
    const wrapper = mountToolbar(0)
    expect(wrapper.get('button[data-testid="print"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[data-testid="export"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[data-testid="clear"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/WorkspaceToolbar.test.ts`
Expected: FAIL — 找不到 `[data-testid="generate"]` / `[data-testid="back"]`（按钮尚未添加）

- [ ] **Step 3: 更新 `src/components/WorkspaceToolbar.vue`**

替换全部内容为：

```vue
<script setup lang="ts">
import type { SaveStatus } from '../composables/useTeachingBook'

const props = defineProps<{
  lessonCount: number
  warningCount: number
  saveStatus: SaveStatus
}>()

defineEmits<{
  upload: []
  print: []
  export: []
  clear: []
  generate: []
  back: []
}>()

const saveStatusLabel: Record<SaveStatus, string> = {
  idle: '',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
}
</script>

<template>
  <header class="workspace-toolbar">
    <button type="button" data-testid="back" @click="$emit('back')">返回列表</button>
    <button type="button" data-testid="upload" @click="$emit('upload')">导入教案</button>
    <button type="button" data-testid="generate" @click="$emit('generate')">生成教案</button>
    <button type="button" data-testid="print" :disabled="lessonCount === 0" @click="$emit('print')">打印整册</button>
    <button type="button" data-testid="export" :disabled="lessonCount === 0" @click="$emit('export')">导出 Markdown</button>
    <button type="button" data-testid="clear" :disabled="lessonCount === 0" @click="$emit('clear')">清空</button>

    <span class="workspace-toolbar-count">共 {{ lessonCount }} 课</span>
    <span v-if="warningCount > 0" class="workspace-toolbar-warning">
      {{ warningCount }} 处提示
    </span>
    <span class="workspace-toolbar-status" :class="`workspace-toolbar-status--${saveStatus}`">
      {{ saveStatusLabel[props.saveStatus] }}
    </span>
  </header>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/WorkspaceToolbar.test.ts`
Expected: PASS — 5 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkspaceToolbar.vue src/components/WorkspaceToolbar.test.ts
git commit -m "feat: add generate and back actions to workspace toolbar"
```

---

## Task 10: 整本列表入口页 `BookListPage.vue`

**Files:**
- Create: `src/components/BookListPage.vue`
- Test: `src/components/BookListPage.test.ts`
- Modify: `src/style.css`

- [ ] **Step 1: 写测试**

创建 `src/components/BookListPage.test.ts`：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import BookListPage from './BookListPage.vue'

vi.mock('../services/booksApi')

describe('BookListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the list of books', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 3 },
    ])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Web 前端开发')
    expect(wrapper.text()).toContain('3 课')
  })

  it('shows an empty state when there are no books', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.text()).toContain('还没有整本')
  })

  it('shows an error and allows retry when loading fails', async () => {
    vi.mocked(booksApi.listBooks).mockRejectedValueOnce(new Error('网络错误。'))
    vi.mocked(booksApi.listBooks).mockResolvedValueOnce([])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.text()).toContain('网络错误。')

    await wrapper.get('button[data-testid="retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('还没有整本')
  })

  it('creates a book and emits open with the new id', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])
    vi.mocked(booksApi.createBook).mockResolvedValue({
      id: 'new-id',
      name: '新整本',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: createEmptyBook(),
    })

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('input[aria-label="新整本名称"]').setValue('新整本')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(booksApi.createBook).toHaveBeenCalledWith('新整本')
    expect(wrapper.emitted('open')).toEqual([['new-id']])
  })

  it('renames a book', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: '旧名称', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.renameBook).mockResolvedValue({ id: 'b1', name: '新名称', updatedAt: '2026-01-02T00:00:00.000Z' })

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('button[data-testid="rename-b1"]').trigger('click')
    await wrapper.get('input[aria-label="整本名称"]').setValue('新名称')
    await wrapper.get('button[data-testid="confirm-rename-b1"]').trigger('click')
    await flushPromises()

    expect(booksApi.renameBook).toHaveBeenCalledWith('b1', '新名称')
    expect(wrapper.text()).toContain('新名称')
  })

  it('deletes a book after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.deleteBook).mockResolvedValue({ ok: true })

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('button[data-testid="delete-b1"]').trigger('click')
    await flushPromises()

    expect(booksApi.deleteBook).toHaveBeenCalledWith('b1')
    expect(wrapper.text()).toContain('还没有整本')
  })

  it('does not delete a book when confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])

    const wrapper = mount(BookListPage)
    await flushPromises()

    await wrapper.get('button[data-testid="delete-b1"]').trigger('click')
    await flushPromises()

    expect(booksApi.deleteBook).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Web 前端开发')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/BookListPage.test.ts`
Expected: FAIL — `Failed to resolve import "./BookListPage.vue"`

- [ ] **Step 3: 实现 `src/components/BookListPage.vue`**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as booksApi from '../services/booksApi'
import type { BookSummary } from '../services/booksApi'

type LoadStatus = 'loading' | 'loaded' | 'error'

const emit = defineEmits<{ open: [id: string] }>()

const books = ref<BookSummary[]>([])
const loadStatus = ref<LoadStatus>('loading')
const loadError = ref<string | null>(null)

const newBookName = ref('')
const actionError = ref<string | null>(null)

const renamingId = ref<string | null>(null)
const renameValue = ref('')

async function loadBooks(): Promise<void> {
  loadStatus.value = 'loading'
  try {
    books.value = await booksApi.listBooks()
    loadStatus.value = 'loaded'
  } catch (error) {
    loadStatus.value = 'error'
    loadError.value = error instanceof Error ? error.message : '加载失败。'
  }
}

onMounted(loadBooks)

async function createBook(): Promise<void> {
  const name = newBookName.value.trim()
  if (!name) return

  try {
    const created = await booksApi.createBook(name)
    newBookName.value = ''
    emit('open', created.id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '创建失败。'
  }
}

function startRename(book: BookSummary): void {
  renamingId.value = book.id
  renameValue.value = book.name
}

function cancelRename(): void {
  renamingId.value = null
}

async function confirmRename(): Promise<void> {
  const id = renamingId.value
  const name = renameValue.value.trim()
  if (!id || !name) return

  try {
    const updated = await booksApi.renameBook(id, name)
    const target = books.value.find((book) => book.id === id)
    if (target) target.name = updated.name
    renamingId.value = null
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '重命名失败。'
  }
}

async function removeBook(book: BookSummary): Promise<void> {
  if (!window.confirm(`确定要删除「${book.name}」吗？此操作无法撤销。`)) return

  try {
    await booksApi.deleteBook(book.id)
    books.value = books.value.filter((entry) => entry.id !== book.id)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '删除失败。'
  }
}
</script>

<template>
  <div class="book-list-page">
    <h1>教学设计整本</h1>

    <form class="book-list-create" @submit.prevent="createBook">
      <input v-model="newBookName" type="text" placeholder="新整本名称" aria-label="新整本名称" />
      <button type="submit">新建整本</button>
    </form>

    <p v-if="actionError" class="app-notice app-notice--error" role="alert">
      {{ actionError }}
      <button type="button" @click="actionError = null">关闭</button>
    </p>

    <p v-if="loadStatus === 'loading'">加载中…</p>

    <div v-else-if="loadStatus === 'error'" class="app-notice app-notice--error" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" data-testid="retry" @click="loadBooks">重试</button>
    </div>

    <template v-else>
      <p v-if="books.length === 0">还没有整本，创建一个开始使用。</p>

      <ul v-else class="book-list">
        <li v-for="book in books" :key="book.id" class="book-list-item">
          <template v-if="renamingId === book.id">
            <input v-model="renameValue" type="text" aria-label="整本名称" />
            <button type="button" :data-testid="`confirm-rename-${book.id}`" @click="confirmRename">保存</button>
            <button type="button" @click="cancelRename">取消</button>
          </template>
          <template v-else>
            <span class="book-list-name">{{ book.name }}</span>
            <span class="book-list-meta">更新于 {{ book.updatedAt }} · {{ book.lessonCount }} 课</span>
            <button type="button" :data-testid="`open-${book.id}`" @click="emit('open', book.id)">打开</button>
            <button type="button" :data-testid="`rename-${book.id}`" @click="startRename(book)">重命名</button>
            <button type="button" :data-testid="`delete-${book.id}`" @click="removeBook(book)">删除</button>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/BookListPage.test.ts`
Expected: PASS — 7 个测试全部通过

- [ ] **Step 5: 新增列表页样式**

在 `src/style.css` 末尾追加：

```css
/* Book list */
.book-list-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 16px;
}

.book-list-create {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.book-list-create input,
.book-list-item input {
  flex: 1 1 auto;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
}

.book-list-create button,
.book-list-item button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  color: var(--green-700);
  cursor: pointer;
  white-space: nowrap;
}

.book-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.book-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.book-list-name {
  font-weight: 600;
  flex: 0 0 auto;
}

.book-list-meta {
  flex: 1 1 auto;
  color: var(--muted);
  font-size: 14px;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/BookListPage.vue src/components/BookListPage.test.ts src/style.css
git commit -m "feat: add book list entry page"
```

---

## Task 11: 提取工作区 `WorkspaceView.vue`

**Files:**
- Create: `src/components/WorkspaceView.vue`
- Test: `src/components/WorkspaceView.test.ts`

- [ ] **Step 1: 写测试**

创建 `src/components/WorkspaceView.test.ts`：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBook, createEmptyTeachingDesign } from '../domain/teachingDesign'
import * as booksApi from '../services/booksApi'
import GenerateLessonDialog from './GenerateLessonDialog.vue'
import WorkspaceView from './WorkspaceView.vue'

vi.mock('../services/booksApi')

function mockBook(data = createEmptyBook()): void {
  vi.mocked(booksApi.getBook).mockResolvedValue({
    id: 'b1',
    name: '示例整本',
    updatedAt: '2026-01-01T00:00:00.000Z',
    data,
  })
}

describe('WorkspaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while the book loads', () => {
    vi.mocked(booksApi.getBook).mockReturnValue(new Promise(() => {}))

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })

    expect(wrapper.text()).toContain('加载中')
  })

  it('shows an error and emits back when loading fails', async () => {
    vi.mocked(booksApi.getBook).mockRejectedValue(new Error('整本不存在。'))

    const wrapper = mount(WorkspaceView, { props: { bookId: 'missing' } })
    await flushPromises()

    expect(wrapper.text()).toContain('整本不存在。')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('renders the toolbar and emits back when loaded', async () => {
    mockBook()

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    expect(wrapper.text()).toContain('点击或拖拽上传')

    await wrapper.get('[data-testid="back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('opens the generate dialog and adds a generated lesson on submit', async () => {
    mockBook()
    vi.mocked(booksApi.generateLesson).mockResolvedValue({
      filename: 'css-flex.md',
      markdown: '# CSS 弹性布局 教学设计',
    })

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    await wrapper.get('[data-testid="generate"]').trigger('click')
    const dialog = wrapper.getComponent(GenerateLessonDialog)

    dialog.vm.$emit('submit', 'CSS 弹性布局')
    await flushPromises()

    expect(booksApi.generateLesson).toHaveBeenCalledWith('CSS 弹性布局')
    expect(wrapper.findComponent(GenerateLessonDialog).exists()).toBe(false)
    expect(wrapper.text()).toContain('CSS 弹性布局')
  })

  it('clears the lessons after confirmation', async () => {
    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    mockBook(data)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    await wrapper.get('[data-testid="clear"]').trigger('click')

    expect(wrapper.text()).toContain('点击或拖拽上传')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/components/WorkspaceView.test.ts`
Expected: FAIL — `Failed to resolve import "./WorkspaceView.vue"`

- [ ] **Step 3: 实现 `src/components/WorkspaceView.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { type DuplicateStrategy, useTeachingBook } from '../composables/useTeachingBook'
import type { TeachingDesign } from '../domain/teachingDesign'
import { createBookZip, downloadBlob } from '../services/zipExporter'
import A4Workspace from './A4Workspace.vue'
import GenerateLessonDialog from './GenerateLessonDialog.vue'
import ImportConflictDialog from './ImportConflictDialog.vue'
import LessonSidebar from './LessonSidebar.vue'
import PrintBook from './PrintBook.vue'
import UploadDropzone from './UploadDropzone.vue'
import WorkspaceToolbar from './WorkspaceToolbar.vue'

const props = defineProps<{ bookId: string }>()

defineEmits<{ back: [] }>()

const {
  book,
  loadStatus,
  loadError,
  saveStatus,
  lastError,
  selectedDesign,
  hasDesigns,
  warningCount,
  importFiles,
  detectDuplicates,
  selectPage,
  moveDesign,
  removeDesign,
  updateCover,
  updateDesign,
  clearBook,
  generateLesson,
} = useTeachingBook(props.bookId)

const pendingFiles = ref<File[]>([])
const duplicateNames = ref<string[]>([])
const errorMessage = ref<string | null>(null)
const uploadRef = ref<InstanceType<typeof UploadDropzone> | null>(null)

const showGenerateDialog = ref(false)
const generateLoading = ref(false)
const generateError = ref<string | null>(null)

async function runImport(files: File[], strategy: DuplicateStrategy): Promise<void> {
  const result = await importFiles(files, strategy)
  if (result.failed.length > 0) {
    errorMessage.value = `${result.failed.length} 个文件导入失败：${result.failed
      .map((entry) => `${entry.filename}（${entry.message}）`)
      .join('、')}`
  }
}

async function handleFiles(files: File[]): Promise<void> {
  const duplicates = detectDuplicates(files)
  if (duplicates.length > 0) {
    pendingFiles.value = files
    duplicateNames.value = duplicates
    return
  }
  await runImport(files, 'keep')
}

async function resolveConflict(strategy: DuplicateStrategy | 'cancel'): Promise<void> {
  const files = pendingFiles.value
  pendingFiles.value = []
  duplicateNames.value = []
  if (strategy === 'cancel') return
  await runImport(files, strategy)
}

function triggerUpload(): void {
  uploadRef.value?.openPicker()
}

function handlePrint(): void {
  window.print()
}

async function handleExport(): Promise<void> {
  try {
    const blob = await createBookZip(book.value.designs)
    downloadBlob(blob, 'teaching-design-book.zip')
  } catch {
    errorMessage.value = '导出失败，请重试。'
  }
}

function handleClear(): void {
  if (book.value.designs.length === 0) {
    return
  }
  if (window.confirm('确定要清空当前所有教案吗？此操作无法撤销。')) {
    clearBook()
  }
}

function handleDesignUpdate(design: TeachingDesign): void {
  updateDesign(design.id, (target) => Object.assign(target, design))
}

function openGenerateDialog(): void {
  generateError.value = null
  showGenerateDialog.value = true
}

async function handleGenerateSubmit(topic: string): Promise<void> {
  generateLoading.value = true
  generateError.value = null
  const result = await generateLesson(topic)
  generateLoading.value = false

  if (result.ok) {
    showGenerateDialog.value = false
  } else {
    generateError.value = result.message
  }
}

function cancelGenerate(): void {
  showGenerateDialog.value = false
  generateError.value = null
}
</script>

<template>
  <div class="app-shell">
    <p v-if="loadStatus === 'loading'">加载中…</p>

    <div v-else-if="loadStatus === 'error'" class="app-notice app-notice--error" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" @click="$emit('back')">返回列表</button>
    </div>

    <template v-else>
      <ImportConflictDialog
        v-if="duplicateNames.length > 0"
        :duplicates="duplicateNames"
        @replace="resolveConflict('replace')"
        @keep="resolveConflict('keep')"
        @cancel="resolveConflict('cancel')"
      />
      <GenerateLessonDialog
        v-if="showGenerateDialog"
        :loading="generateLoading"
        :error="generateError"
        @submit="handleGenerateSubmit"
        @cancel="cancelGenerate"
      />

      <p v-if="errorMessage" class="app-notice app-notice--error" role="alert">
        {{ errorMessage }}
        <button type="button" @click="errorMessage = null">关闭</button>
      </p>
      <p v-if="saveStatus === 'error' && lastError" class="app-notice app-notice--error" role="alert">
        {{ lastError }}
      </p>

      <WorkspaceToolbar
        :lesson-count="book.designs.length"
        :warning-count="warningCount"
        :save-status="saveStatus"
        @back="$emit('back')"
        @upload="triggerUpload"
        @generate="openGenerateDialog"
        @print="handlePrint"
        @export="handleExport"
        @clear="handleClear"
      />

      <UploadDropzone v-if="!hasDesigns" @files="handleFiles" />

      <template v-else>
        <div class="workspace-layout">
          <LessonSidebar
            :designs="book.designs"
            :selected-id="book.selectedId"
            @select="selectPage"
            @remove="removeDesign"
            @move="moveDesign"
          />
          <A4Workspace
            :cover="book.cover"
            :selected-id="book.selectedId"
            :selected-design="selectedDesign"
            @update:cover="updateCover"
            @update:design="handleDesignUpdate"
          />
        </div>
        <UploadDropzone ref="uploadRef" compact class="visually-hidden" @files="handleFiles" />
      </template>

      <PrintBook :cover="book.cover" :designs="book.designs" />
    </template>
  </div>
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/components/WorkspaceView.test.ts`
Expected: PASS — 5 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkspaceView.vue src/components/WorkspaceView.test.ts
git commit -m "feat: extract workspace view with generate and back actions"
```

---

## Task 12: 重写 `App.vue`（整本列表 <-> 工作区切换）

**Files:**
- Modify: `src/App.vue`
- Modify: `src/App.test.ts`

- [ ] **Step 1: 重写测试**

替换 `src/App.test.ts` 全部内容为：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { createEmptyBook } from './domain/teachingDesign'
import * as booksApi from './services/booksApi'

vi.mock('./services/booksApi')

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with the book list entry page', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('教学设计整本')
    expect(wrapper.text()).toContain('新建整本')
  })

  it('switches to the workspace view when a book is opened', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: '示例整本', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.getBook).mockResolvedValue({
      id: 'b1',
      name: '示例整本',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: createEmptyBook(),
    })

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="open-b1"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="back"]').exists()).toBe(true)
  })

  it('returns to the book list when back is emitted', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: '示例整本', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])
    vi.mocked(booksApi.getBook).mockResolvedValue({
      id: 'b1',
      name: '示例整本',
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: createEmptyBook(),
    })

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="open-b1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="back"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('教学设计整本')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run src/App.test.ts`
Expected: FAIL — 当前 `App.vue` 直接渲染工作区（无 `教学设计整本`/`新建整本` 文本），且不存在 `[data-testid="open-b1"]`。

- [ ] **Step 3: 重写 `src/App.vue`**

替换全部内容为：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import BookListPage from './components/BookListPage.vue'
import WorkspaceView from './components/WorkspaceView.vue'

const currentBookId = ref<string | null>(null)

function openBook(id: string): void {
  currentBookId.value = id
}

function backToList(): void {
  currentBookId.value = null
}
</script>

<template>
  <BookListPage v-if="!currentBookId" @open="openBook" />
  <WorkspaceView v-else :key="currentBookId" :book-id="currentBookId" @back="backToList" />
</template>
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run src/App.test.ts`
Expected: PASS — 3 个测试全部通过

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/App.test.ts
git commit -m "feat: switch between book list and workspace view in App"
```

---

## Task 13: 移除 localStorage 相关代码

**Files:**
- Delete: `src/services/bookStorage.ts`
- Delete: `src/services/bookStorage.test.ts`
- Delete: `src/components/RestoreDraftDialog.vue`

- [ ] **Step 1: 确认无残留引用**

```bash
grep -rn "bookStorage\|RestoreDraftDialog" src
```

Expected: 无输出（Task 7 已重写 `useTeachingBook.ts` 不再引用 `bookStorage`，Task 12 已重写 `App.vue` 不再引用 `RestoreDraftDialog`）。

- [ ] **Step 2: 删除文件**

```bash
git rm src/services/bookStorage.ts src/services/bookStorage.test.ts src/components/RestoreDraftDialog.vue
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove localStorage-based persistence"
```

---

## Task 14: 最终验证

**Files:** 无新增/修改文件，仅运行验证命令。

- [ ] **Step 1: 运行前端测试**

```bash
npx vitest run
```

Expected: 全部测试通过，包括既有的 `markdownParser`/`markdownWriter`/`zipExporter`/`PrintBook` 等测试与本计划新增的测试。

- [ ] **Step 2: 运行后端测试**

```bash
bun test server
```

Expected: `server/db.test.ts`、`server/routes/books.test.ts`、`server/routes/generate.test.ts` 全部通过（共 28 个测试）。

- [ ] **Step 3: 运行前端类型检查与构建**

```bash
npm run build
```

Expected: `vue-tsc -b && vite build` 成功，无类型错误，产出 `dist/`。

- [ ] **Step 4: 手动验证（按设计文档 10.3 节）**

```bash
npm run server:dev
```

在另一个终端：

```bash
npm run dev
```

在浏览器中打开 Vite dev server 地址，依次验证：

1. 首次进入显示「教学设计整本」列表（应为空），点击「新建整本」创建一本，自动进入工作区。
2. 上传 `data/Web` 目录下的教案 `.md` 文件，确认解析与编辑正常。
3. 编辑封面或某课内容，等待约 300ms，工具栏显示「已保存」；刷新页面后内容仍存在（从服务器 `GET /api/books/:id` 恢复）。
4. 点击「生成教案」，输入主题，确认生成成功后新增一课，结构符合模板（含警告提示，如有）。
5. 点击「返回列表」，确认列表中该整本的更新时间和课时数已更新。
6. 删除该整本，确认从列表移除；删除前需确认弹窗。

若 `.env` 未配置 `DEEPSEEK_API_KEY`，「生成教案」应显示后端返回的 500 错误提示（"未配置 DEEPSEEK_API_KEY。"），不影响其他功能。

- [ ] **Step 5: 最终确认**

确认以下验收标准均已满足（对照设计文档第 11 节）：

- [ ] 应用启动后先显示整本列表，可创建、打开、重命名、删除整本
- [ ] 进入整本后，原有上传、编辑、拖拽排序、打印、ZIP 导出功能行为不变
- [ ] 编辑内容 300ms 防抖后通过 API 保存到 SQLite，刷新后从服务器恢复
- [ ] 工具栏「生成教案」可生成并加入新课时，应用既有警告机制
- [ ] `npx vitest run` 与 `bun test server` 均通过
- [ ] `bun run server/index.ts` 单进程同时提供 API 与前端静态资源

---

## Self-Review

**Spec coverage：**

- §3 核心产品决策（列表入口、清空与删除分离、生成教案按钮、非破坏性错误提示）→ Task 7（`clearBook` 语义说明）、Task 9-12。
- §5 数据库设计（`books` 表结构、`data` JSON 复用、`updated_at`）→ Task 2。
- §6 API 表（`/api/books*`、`/api/generate`）→ Task 3、Task 4。
- §7.1 `booksApi.ts` → Task 6。
- §7.2 `BookListPage.vue`（列表/新建/重命名/删除/错误重试）→ Task 10。
- §7.3 `useTeachingBook` 重写（按 `bookId` 加载/保存、移除 `restore`/`pendingDuplicateFiles`、`generateLesson`）→ Task 7。
- §7.4 `GenerateLessonDialog.vue` → Task 8。
- §7.5 `WorkspaceToolbar.vue`（「生成教案」「返回列表」）→ Task 9。
- §7.6 `App.vue`（列表/工作区切换）→ Task 12（通过 Task 11 拆出的 `WorkspaceView.vue`）。
- §7.7 移除内容 → Task 13。
- §8 开发与构建流程（依赖、脚本、代理、`.env`）→ Task 1、Task 5。
- §9 错误处理与状态反馈（加载失败显示返回列表入口、保存失败提示、生成失败对话框内提示）→ Task 7、Task 11。
- §10 测试策略 → 每个任务均含对应测试；后端 `server/*.test.ts` 覆盖 §10.2；手动验证覆盖 §10.3 → Task 14 Step 4。
- §11 验收标准 → Task 14 Step 5。

无遗漏章节。

**Placeholder scan：** 全文搜索 "TBD"、"TODO"、"待实现"、"类似 Task" 均无匹配；所有代码步骤均含完整代码。

**Type consistency：**

- `TeachingBookStore`（Task 7 定义）字段：`book, loadStatus, loadError, saveStatus, lastError, selectedDesign, hasDesigns, warningCount, importFiles, detectDuplicates, selectPage, moveDesign, removeDesign, updateCover, updateDesign, clearBook, generateLesson` — Task 11 的 `WorkspaceView.vue` 解构使用了全部字段且名称一致。
- `GenerateLessonDialog` props `{ loading, error }` / emits `{ submit, cancel }`（Task 8）与 Task 11 中的绑定一致。
- `WorkspaceToolbar` emits `{ upload, print, export, clear, generate, back }`（Task 9）与 Task 11 中 `@upload/@print/@export/@clear/@generate/@back` 一一对应。
- `BookListPage` emits `{ open: [id: string] }`（Task 10）与 Task 12 `@open="openBook"` 一致。
- `booksApi` 导出的 `BookSummary/BookRecord/BookMeta/GenerateResult` 及函数签名（Task 6）与 Task 7、10、11、12 中的 mock/调用一致。

未发现不一致项。
