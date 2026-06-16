# Remove Cover Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cover page from the teaching-book data model, stored JSON, and workspace UI.

**Architecture:** First make the domain model lesson-only, then add server-side normalization so old book JSON loses `cover` and invalid `selectedId` values. Finally update the Vue store and components so users can only select and edit lesson pages.

**Tech Stack:** Vue 3, Vitest, Vue Test Utils, Bun, bun:sqlite, Hono, TypeScript.

---

## File Structure

- Modify `src/domain/teachingDesign.ts`: remove `BookCover`, remove `cover`, and change `selectedId` to `DesignId | null`.
- Modify `src/domain/teachingDesign.test.ts`: update defaults and type assertions.
- Modify `server/db.ts`: normalize stored book JSON on `openDb()` and before saving.
- Modify `server/db.test.ts`: cover migration of legacy `cover`, legacy `'cover'` selection, invalid selected ids, and route-safe persistence.
- Modify `server/routes/books.test.ts`: update save/get expectations so `cover` is not persisted.
- Modify `src/composables/useTeachingBook.ts`: remove `updateCover`, use `null` selection, and update import/delete/clear behavior.
- Modify `src/composables/useTeachingBook.test.ts`: update tests away from cover and add null-selection coverage.
- Modify `src/components/LessonSidebar.vue`: remove cover props/events/UI.
- Modify `src/components/LessonSidebar.test.ts`: assert no cover button and keep drag/drop coverage.
- Modify `src/components/A4Workspace.vue`: remove cover props/events/import and render only selected lessons.
- Create `src/components/A4Workspace.test.ts`: assert no cover page is rendered.
- Modify `src/components/WorkspaceView.vue`: stop passing cover/update-cover.
- Modify `src/components/WorkspaceView.test.ts`: assert the loaded workspace does not show a cover entry.
- Delete `src/components/CoverPage.vue`.
- Modify `src/style.css`: remove cover-specific CSS.

### Task 1: Domain Model

**Files:**
- Modify: `src/domain/teachingDesign.test.ts`
- Modify: `src/domain/teachingDesign.ts`

- [ ] **Step 1: Write failing domain tests**

In `src/domain/teachingDesign.test.ts`, replace the `createEmptyBook` describe block with:

```ts
describe('createEmptyBook', () => {
  it('creates the schema defaults with no selected page and an ISO timestamp', () => {
    const book = createEmptyBook()

    expect(book.schemaVersion).toBe(BOOK_SCHEMA_VERSION)
    expect(book.selectedId).toBeNull()
    expect(book).not.toHaveProperty('cover')
    expect(new Date(book.updatedAt).toISOString()).toBe(book.updatedAt)
  })

  it('creates independent design collections', () => {
    const first = createEmptyBook()
    const second = createEmptyBook()

    first.designs.push(createEmptyTeachingDesign('1.md'))

    expect(first.designs).not.toBe(second.designs)
    expect(second.designs).toEqual([])
  })
})
```

In the `domain types` test, replace the selected id assertion with:

```ts
    expectTypeOf<TeachingBook['selectedId']>().toEqualTypeOf<DesignId | null>()
```

- [ ] **Step 2: Run domain tests to verify failure**

Run:

```bash
rtk npm run test -- src/domain/teachingDesign.test.ts
```

Expected: FAIL because `createEmptyBook()` still returns `cover` and `selectedId: 'cover'`.

- [ ] **Step 3: Update domain model**

In `src/domain/teachingDesign.ts`, delete:

```ts
export interface BookCover {
  courseName: string
  teacherName: string
}
```

Replace `TeachingBook` with:

```ts
export interface TeachingBook {
  schemaVersion: typeof BOOK_SCHEMA_VERSION
  designs: TeachingDesign[]
  selectedId: DesignId | null
  updatedAt: string
}
```

Replace `createEmptyBook()` with:

```ts
export function createEmptyBook(): TeachingBook {
  return {
    schemaVersion: BOOK_SCHEMA_VERSION,
    designs: [],
    selectedId: null,
    updatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Run domain tests to verify pass**

Run:

```bash
rtk npm run test -- src/domain/teachingDesign.test.ts
```

Expected: PASS.

### Task 2: Server Data Normalization

**Files:**
- Modify: `server/db.test.ts`
- Modify: `server/routes/books.test.ts`
- Modify: `server/db.ts`

- [ ] **Step 1: Write failing DB migration tests**

In `server/db.test.ts`, add these imports:

```ts
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
```

Add this helper above `describe('db', () => {`:

```ts
function tempDbPath(name: string): string {
  const path = join(tmpdir(), `fake-teaching-design-${name}-${crypto.randomUUID()}.db`)
  if (existsSync(path)) rmSync(path)
  return path
}
```

Append these tests inside `describe('db', () => { ... })`:

```ts
  it('migrates legacy cover data and cover selection on open', () => {
    const path = tempDbPath('cover-migration')
    const db = openDb(path)
    const design = createEmptyTeachingDesign('1.md')
    const legacy = {
      schemaVersion: 1,
      cover: { courseName: '旧课程', teacherName: '旧教师' },
      designs: [design],
      selectedId: 'cover',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    db.run('INSERT INTO books (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
      'legacy-1',
      '旧整本',
      JSON.stringify(legacy),
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ])
    db.close()

    const reopened = openDb(path)
    const migrated = getBook(reopened, 'legacy-1')!.data
    const raw = reopened.query<{ data: string }, [string]>('SELECT data FROM books WHERE id = ?').get('legacy-1')!.data
    reopened.close()
    rmSync(path)

    expect(migrated).not.toHaveProperty('cover')
    expect(migrated.selectedId).toBe(design.id)
    expect(JSON.parse(raw)).not.toHaveProperty('cover')
  })

  it('migrates legacy cover selection to null when no lessons exist', () => {
    const path = tempDbPath('empty-cover-migration')
    const db = openDb(path)
    db.run('INSERT INTO books (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
      'legacy-empty',
      '空整本',
      JSON.stringify({
        schemaVersion: 1,
        cover: { courseName: '旧课程', teacherName: '旧教师' },
        designs: [],
        selectedId: 'cover',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ])
    db.close()

    const reopened = openDb(path)
    const migrated = getBook(reopened, 'legacy-empty')!.data
    reopened.close()
    rmSync(path)

    expect(migrated).not.toHaveProperty('cover')
    expect(migrated.selectedId).toBeNull()
  })

  it('normalizes invalid selected ids to the first lesson', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')
    const data = createEmptyBook()
    const design = createEmptyTeachingDesign('1.md')
    data.designs.push(design)
    db.run('UPDATE books SET data = ? WHERE id = ?', [
      JSON.stringify({ ...data, selectedId: 'missing-id' }),
      created.id,
    ])

    expect(getBook(db, created.id)?.data.selectedId).toBe(design.id)
  })
```

Update the existing `saves book data and updates updated_at` test to stop writing `data.cover` and assert `cover` is absent:

```ts
  it('saves book data and updates updated_at', () => {
    const db = openDb(':memory:')
    const created = createBook(db, '示例整本')
    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))

    setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    const result = saveBookData(db, created.id, data)

    expect(result).toEqual({ id: created.id, name: '示例整本', updatedAt: '2026-02-01T00:00:00.000Z' })
    expect(getBook(db, created.id)?.data).not.toHaveProperty('cover')
  })
```

- [ ] **Step 2: Update route test expectations**

In `server/routes/books.test.ts`, replace the `saves book data` test body with:

```ts
  it('saves book data without cover state', async () => {
    const created = await createViaApi('示例整本')

    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))

    const res = await app.request(`/api/books/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { ...data, cover: { courseName: '旧课程', teacherName: '旧教师' } } }),
    })
    expect(res.status).toBe(200)

    const fetched = await app.request(`/api/books/${created.id}`)
    const body = (await fetched.json()) as { data: Record<string, unknown> }
    expect(body.data).not.toHaveProperty('cover')
  })
```

Also update the import in `server/routes/books.test.ts`:

```ts
import { createEmptyBook, createEmptyTeachingDesign } from '../../src/domain/teachingDesign'
```

- [ ] **Step 3: Run DB and books route tests to verify failure**

Run:

```bash
rtk bun test server/db.test.ts server/routes/books.test.ts
```

Expected: FAIL because stored JSON still preserves `cover` and `'cover'` selected ids.

- [ ] **Step 4: Implement book normalization**

In `server/db.ts`, add these internal types after `interface BookRow`:

```ts
type StoredTeachingBook = Omit<TeachingBook, 'selectedId'> & {
  cover?: unknown
  selectedId?: string | null
}

interface NormalizedBookData {
  data: TeachingBook
  changed: boolean
}
```

Add this helper before `openDb()`:

```ts
function normalizeBookData(raw: StoredTeachingBook): NormalizedBookData {
  const data = { ...raw, designs: Array.isArray(raw.designs) ? raw.designs : [] } as StoredTeachingBook
  let changed = false

  if ('cover' in data) {
    delete data.cover
    changed = true
  }

  const selectedId = data.selectedId ?? null
  const firstDesignId = data.designs[0]?.id ?? null
  const selectedExists =
    selectedId !== null && data.designs.some((design) => design.id === selectedId)

  let normalizedSelectedId: TeachingBook['selectedId']
  if (selectedId === 'cover' || (selectedId !== null && !selectedExists)) {
    normalizedSelectedId = firstDesignId
    if (selectedId !== normalizedSelectedId) changed = true
  } else {
    normalizedSelectedId = selectedId as TeachingBook['selectedId']
  }

  return {
    data: {
      schemaVersion: data.schemaVersion,
      designs: data.designs,
      selectedId: normalizedSelectedId,
      updatedAt: data.updatedAt,
    },
    changed,
  }
}

function migrateStoredBooks(db: Database): void {
  const rows = db.query<{ id: string; data: string }, []>('SELECT id, data FROM books').all()
  for (const row of rows) {
    const normalized = normalizeBookData(JSON.parse(row.data) as StoredTeachingBook)
    if (normalized.changed) {
      db.run('UPDATE books SET data = ? WHERE id = ?', [JSON.stringify(normalized.data), row.id])
    }
  }
}

function parseBookData(data: string): TeachingBook {
  return normalizeBookData(JSON.parse(data) as StoredTeachingBook).data
}
```

Update `openDb()` to run migration:

```ts
export function openDb(path: string): Database {
  const db = new Database(path)
  db.run('PRAGMA foreign_keys = ON')
  db.run(SCHEMA)
  migrateStoredBooks(db)
  return db
}
```

Replace all direct `JSON.parse(row.data) as TeachingBook` uses in `listBooks()` and `getBook()` with `parseBookData(row.data)`.

In `saveBookData()`, normalize before storing:

```ts
  const normalized = normalizeBookData(data as StoredTeachingBook).data
  db.run('UPDATE books SET data = ?, updated_at = ? WHERE id = ?', [JSON.stringify(normalized), now, id])
```

- [ ] **Step 5: Run DB and books route tests to verify pass**

Run:

```bash
rtk bun test server/db.test.ts server/routes/books.test.ts
```

Expected: PASS.

### Task 3: Store Selection Without Cover

**Files:**
- Modify: `src/composables/useTeachingBook.test.ts`
- Modify: `src/composables/useTeachingBook.ts`

- [ ] **Step 1: Write failing store tests**

In `src/composables/useTeachingBook.test.ts`:

Replace the `loads the book from the API` test with:

```ts
  it('loads the book from the API without cover state', async () => {
    const data = createEmptyBook()
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    expect(booksApi.getBook).toHaveBeenCalledWith('b1')
    expect(store.loadStatus.value).toBe('loaded')
    expect(store.book.value).not.toHaveProperty('cover')
  })
```

Replace autosave test mutation:

```ts
    const design = createEmptyTeachingDesign('1.md')
    store.book.value.designs.push(design)
    store.updateDesign(design.id, (target) => {
      target.topic = '新课程名'
    })
```

Replace the save-error test mutation with the same `updateDesign()` pattern.

Replace the clear test with:

```ts
  it('clearBook empties designs and clears selection', async () => {
    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    data.selectedId = data.designs[0]!.id
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    store.clearBook()

    expect(store.book.value.designs).toEqual([])
    expect(store.book.value.selectedId).toBeNull()
  })
```

Add this test inside the describe block:

```ts
  it('selects null after removing the last selected lesson', async () => {
    const data = createEmptyBook()
    const design = createEmptyTeachingDesign('1.md')
    data.designs.push(design)
    data.selectedId = design.id
    mockGetBook(data)

    const store = useTeachingBook('b1')
    await flushPromises()

    store.removeDesign(design.id)

    expect(store.book.value.designs).toEqual([])
    expect(store.book.value.selectedId).toBeNull()
    expect(store.selectedDesign.value).toBeNull()
  })
```

- [ ] **Step 2: Run store tests to verify failure**

Run:

```bash
rtk npm run test -- src/composables/useTeachingBook.test.ts
```

Expected: FAIL because `updateCover` still exists, `clearBook()` selects `'cover'`, and types still mention cover.

- [ ] **Step 3: Update useTeachingBook types and behavior**

In `src/composables/useTeachingBook.ts`:

Remove `type BookCover` from imports.

Change `TeachingBookStore` methods:

```ts
  selectPage: (id: DesignId) => void
  moveDesign: (from: number, to: number) => void
  removeDesign: (id: DesignId) => void
  updateDesign: (id: DesignId, updater: (design: TeachingDesign) => void) => void
```

Delete `updateCover` from the interface and returned object.

Replace `syncDerived()` selected-design logic with:

```ts
    selectedDesign.value = current.selectedId === null
      ? null
      : current.designs.find((design) => design.id === current.selectedId) ?? null
```

Replace the import selection block with:

```ts
    if (imported > 0 && book.value.selectedId === null && book.value.designs.length > 0) {
      book.value.selectedId = book.value.designs[0]!.id
    }
```

Change `selectPage()` signature:

```ts
  function selectPage(id: DesignId): void {
    book.value.selectedId = id
  }
```

In `removeDesign()`, replace fallback selection with:

```ts
      book.value.selectedId = designs[index]?.id ?? designs[index - 1]?.id ?? null
```

Delete `updateCover()`.

In `clearBook()`, set:

```ts
    book.value.selectedId = null
```

- [ ] **Step 4: Run store tests to verify pass**

Run:

```bash
rtk npm run test -- src/composables/useTeachingBook.test.ts
```

Expected: PASS.

### Task 4: Components Without Cover

**Files:**
- Modify: `src/components/LessonSidebar.test.ts`
- Create: `src/components/A4Workspace.test.ts`
- Modify: `src/components/WorkspaceView.test.ts`
- Modify: `src/components/LessonSidebar.vue`
- Modify: `src/components/A4Workspace.vue`
- Modify: `src/components/WorkspaceView.vue`
- Delete: `src/components/CoverPage.vue`
- Modify: `src/style.css`

- [ ] **Step 1: Write failing component tests**

In `src/components/LessonSidebar.test.ts`, use `selectedId: designs[0]?.id ?? null` in the existing mount. Add:

```ts
  it('does not render a cover navigation item', () => {
    const designs = [createEmptyTeachingDesign('1.md')]
    const wrapper = mount(LessonSidebar, {
      props: { designs, selectedId: designs[0]?.id ?? null },
    })

    expect(wrapper.text()).not.toContain('封面')
  })
```

Create `src/components/A4Workspace.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import A4Workspace from './A4Workspace.vue'
import TeachingDesignPage from './TeachingDesignPage.vue'

describe('A4Workspace', () => {
  it('renders the selected lesson without a cover page', () => {
    const design = createEmptyTeachingDesign('1.md')
    design.topic = '第一课'

    const wrapper = mount(A4Workspace, {
      props: { selectedDesign: design },
    })

    expect(wrapper.find('.cover-page').exists()).toBe(false)
    expect(wrapper.findComponent(TeachingDesignPage).exists()).toBe(true)
    expect(wrapper.text()).toContain('第一课')
  })

  it('renders no page when no lesson is selected', () => {
    const wrapper = mount(A4Workspace, {
      props: { selectedDesign: null },
    })

    expect(wrapper.find('.page').exists()).toBe(false)
  })
})
```

In `src/components/WorkspaceView.test.ts`, add this test:

```ts
  it('does not render a cover entry when lessons exist', async () => {
    const data = createEmptyBook()
    data.designs.push(createEmptyTeachingDesign('1.md'))
    data.selectedId = data.designs[0]!.id
    mockBook(data)

    const wrapper = mount(WorkspaceView, { props: { bookId: 'b1' } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('封面')
  })
```

- [ ] **Step 2: Run component tests to verify failure**

Run:

```bash
rtk npm run test -- src/components/LessonSidebar.test.ts src/components/A4Workspace.test.ts src/components/WorkspaceView.test.ts
```

Expected: FAIL because `LessonSidebar` still renders cover and `A4Workspace` still requires cover props/imports `CoverPage`.

- [ ] **Step 3: Update LessonSidebar**

In `src/components/LessonSidebar.vue`:

Change props:

```ts
defineProps<{
  designs: TeachingDesign[]
  selectedId: DesignId | null
}>()
```

Change emits:

```ts
const emit = defineEmits<{
  select: [id: DesignId]
  remove: [id: DesignId]
  move: [from: number, to: number]
}>()
```

Delete the `<button class="lesson-sidebar-item lesson-sidebar-cover">...</button>` block.

- [ ] **Step 4: Update A4Workspace**

Replace `src/components/A4Workspace.vue` with:

```vue
<script setup lang="ts">
import type { TeachingDesign } from '../domain/teachingDesign'
import TeachingDesignPage from './TeachingDesignPage.vue'

defineProps<{
  selectedDesign: TeachingDesign | null
}>()

const emit = defineEmits<{
  'update:design': [design: TeachingDesign]
}>()
</script>

<template>
  <div class="a4-workspace">
    <div class="a4-paper">
      <TeachingDesignPage
        v-if="selectedDesign"
        :design="selectedDesign"
        :editable="true"
        @update:design="emit('update:design', $event)"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 5: Update WorkspaceView**

In `src/components/WorkspaceView.vue`:

Remove `updateCover` from the `useTeachingBook()` destructuring.

Replace the `A4Workspace` usage with:

```vue
          <A4Workspace
            :selected-design="selectedDesign"
            @update:design="handleDesignUpdate"
          />
```

- [ ] **Step 6: Delete cover component and CSS**

Delete `src/components/CoverPage.vue`.

In `src/style.css`, delete the whole section from:

```css
/* Cover page */
```

through the `.cover-field-value` rule.

Also delete `.lesson-sidebar-cover` rules because no element uses that class anymore.

- [ ] **Step 7: Run component tests to verify pass**

Run:

```bash
rtk npm run test -- src/components/LessonSidebar.test.ts src/components/A4Workspace.test.ts src/components/WorkspaceView.test.ts
```

Expected: PASS.

### Task 5: Cleanup References and Verify

- [ ] **Step 1: Search for remaining cover references**

Run:

```bash
rtk rg -n "CoverPage|BookCover|cover|selectedId: 'cover'|'cover'|封面|lesson-sidebar-cover|cover-page" src server
```

Expected: Output contains only migration compatibility references in `server/db.ts`, `server/db.test.ts`, and `server/routes/books.test.ts`. It must not contain `src/components/CoverPage.vue`, `BookCover`, UI text `封面`, `lesson-sidebar-cover`, or `.cover-page`.

- [ ] **Step 2: Run full frontend tests**

Run:

```bash
rtk npm run test
```

Expected: PASS.

- [ ] **Step 3: Run backend tests**

Run:

```bash
rtk npm run test:server
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
rtk npm run build
```

Expected: PASS.

- [ ] **Step 5: Review diff**

Run:

```bash
rtk git diff -- src/domain/teachingDesign.ts src/domain/teachingDesign.test.ts server/db.ts server/db.test.ts server/routes/books.test.ts src/composables/useTeachingBook.ts src/composables/useTeachingBook.test.ts src/components/LessonSidebar.vue src/components/LessonSidebar.test.ts src/components/A4Workspace.vue src/components/A4Workspace.test.ts src/components/WorkspaceView.vue src/components/WorkspaceView.test.ts src/components/CoverPage.vue src/style.css
```

Expected: Diff removes cover data/UI, adds migration, updates tests, and does not include unrelated `index.html`.

- [ ] **Step 6: Commit implementation**

Run:

```bash
rtk git add src/domain/teachingDesign.ts src/domain/teachingDesign.test.ts server/db.ts server/db.test.ts server/routes/books.test.ts src/composables/useTeachingBook.ts src/composables/useTeachingBook.test.ts src/components/LessonSidebar.vue src/components/LessonSidebar.test.ts src/components/A4Workspace.vue src/components/A4Workspace.test.ts src/components/WorkspaceView.vue src/components/WorkspaceView.test.ts src/components/CoverPage.vue src/style.css
rtk git commit -m "feat: remove cover page"
```

Expected: Commit succeeds.
