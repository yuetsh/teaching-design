# Unified App Controls Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify login, book list, and user management controls under one shared app-shell visual system.

**Architecture:** Add reusable utility classes to `src/style.css`, then update the affected Vue templates to opt into those classes. Keep behavior in the components unchanged and use component tests to lock in the class variants for primary, neutral, and danger actions.

**Tech Stack:** Vue 3 single-file components, scoped and global CSS, Vitest, Vue Test Utils, Vite.

---

## File Structure

- Modify `src/style.css`: add shared app-shell classes for pages, headers, buttons, fields, selects, tables, and error text.
- Modify `src/components/LoginPage.vue`: replace local form styling with shared classes and keep the submit flow unchanged.
- Modify `src/components/BookListPage.vue`: apply shared page/header/button/field classes and remove one-off scoped header styles.
- Modify `src/components/AdminPage.vue`: apply shared page/header/button/field/table classes and remove one-off scoped button/input/table styles.
- Modify `src/components/BookListPage.test.ts`: assert the book list uses primary, neutral, and danger button classes.
- Create `src/components/LoginPage.test.ts`: assert the login form uses shared field and primary button classes while preserving submit behavior.
- Create `src/components/AdminPage.test.ts`: assert the admin form, navigation buttons, create button, table, and delete button use shared classes while preserving load behavior.

### Task 1: Add Style Class Tests

**Files:**
- Modify: `src/components/BookListPage.test.ts`
- Create: `src/components/LoginPage.test.ts`
- Create: `src/components/AdminPage.test.ts`

- [ ] **Step 1: Add BookListPage style assertions**

Append this test inside the existing `describe('BookListPage', () => { ... })` block in `src/components/BookListPage.test.ts`:

```ts
  it('uses shared app control classes for actions', async () => {
    vi.mocked(booksApi.listBooks).mockResolvedValue([
      { id: 'b1', name: 'Web 前端开发', updatedAt: '2026-01-01T00:00:00.000Z', lessonCount: 0 },
    ])

    const wrapper = mount(BookListPage)
    await flushPromises()

    expect(wrapper.get('form.book-list-create input').classes()).toContain('ui-field')
    expect(wrapper.get('form.book-list-create button[type="submit"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--primary']),
    )
    expect(wrapper.get('button[data-testid="open-b1"]').classes()).toContain('ui-button')
    expect(wrapper.get('button[data-testid="rename-b1"]').classes()).toContain('ui-button')
    expect(wrapper.get('button[data-testid="delete-b1"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--danger']),
    )
  })
```

- [ ] **Step 2: Create LoginPage tests**

Create `src/components/LoginPage.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginPage from './LoginPage.vue'

const login = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ login }),
}))

describe('LoginPage', () => {
  it('uses shared form field and primary button classes', () => {
    const wrapper = mount(LoginPage)

    expect(wrapper.get('#username').classes()).toContain('ui-field')
    expect(wrapper.get('#password').classes()).toContain('ui-field')
    expect(wrapper.get('button[type="submit"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--primary']),
    )
  })
})
```

- [ ] **Step 3: Create AdminPage tests**

Create `src/components/AdminPage.test.ts`:

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPage from './AdminPage.vue'

const authedFetch = vi.fn()
const logout = vi.fn()

vi.mock('../composables/useAuth', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
  useAuth: () => ({ logout }),
}))

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authedFetch.mockResolvedValue([
      { id: 'u1', username: 'teacher', role: 'user', createdAt: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('uses shared app control classes', async () => {
    const wrapper = mount(AdminPage)
    await flushPromises()

    expect(wrapper.get('.admin-page').classes()).toContain('app-page')
    expect(wrapper.get('header').classes()).toContain('app-page-header')
    expect(wrapper.get('input[placeholder="用户名"]').classes()).toContain('ui-field')
    expect(wrapper.get('input[placeholder="密码"]').classes()).toContain('ui-field')
    expect(wrapper.get('select').classes()).toContain('ui-select')
    expect(wrapper.get('button[type="submit"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--primary']),
    )
    expect(wrapper.get('table').classes()).toContain('ui-table')
    expect(wrapper.get('button[data-testid="delete-user-u1"]').classes()).toEqual(
      expect.arrayContaining(['ui-button', 'ui-button--danger']),
    )
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
rtk npm run test -- src/components/BookListPage.test.ts src/components/LoginPage.test.ts src/components/AdminPage.test.ts
```

Expected: FAIL because the new shared classes do not exist on the rendered components yet.

### Task 2: Add Shared App Control CSS

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Add shared classes**

Insert this section in `src/style.css` after the `.app-shell` rule and before the existing toolbar styles:

```css
/* Shared app controls */
.app-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 32px 16px;
}

.app-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.app-page-header h1 {
  margin: 0;
  color: var(--green-700);
  font-size: 24px;
}

.app-page-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ui-button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  color: var(--green-700);
  cursor: pointer;
  white-space: nowrap;
}

.ui-button:hover:not(:disabled) {
  background: var(--green-100);
  border-color: var(--green-600);
}

.ui-button:disabled {
  color: var(--muted);
  border-color: var(--line);
  cursor: not-allowed;
  opacity: 0.6;
}

.ui-button--primary {
  border-color: var(--green-600);
  background: var(--green-600);
  color: #fff;
}

.ui-button--primary:hover:not(:disabled) {
  background: var(--green-700);
  border-color: var(--green-700);
}

.ui-button--danger {
  color: #c0392b;
}

.ui-button--danger:hover:not(:disabled) {
  background: #fdecea;
  border-color: #c0392b;
}

.ui-field,
.ui-select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 12px;
  background: #fff;
  color: #202a33;
}

.ui-field:focus,
.ui-select:focus {
  outline: none;
  border-color: var(--green-600);
  box-shadow: 0 0 0 2px rgba(45, 122, 88, 0.16);
}

.ui-field:disabled,
.ui-select:disabled {
  background: #f4f6f7;
  color: var(--muted);
  cursor: not-allowed;
}

.ui-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  background: #fff;
  border: 1px solid var(--line);
}

.ui-table th,
.ui-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}

.ui-table th {
  background: var(--green-100);
  color: var(--green-700);
  font-weight: 600;
}

.ui-table tr:last-child td {
  border-bottom: none;
}

.ui-error {
  color: #c0392b;
  font-size: 14px;
  margin: 8px 0 0;
}
```

- [ ] **Step 2: Run existing tests**

Run:

```bash
rtk npm run test -- src/components/BookListPage.test.ts src/components/LoginPage.test.ts src/components/AdminPage.test.ts
```

Expected: Still FAIL because component templates have not been updated yet.

### Task 3: Update Components to Use Shared Classes

**Files:**
- Modify: `src/components/LoginPage.vue`
- Modify: `src/components/BookListPage.vue`
- Modify: `src/components/AdminPage.vue`

- [ ] **Step 1: Update LoginPage template classes**

Change `src/components/LoginPage.vue` so both inputs include `class="ui-field"` and the submit button includes `class="ui-button ui-button--primary"`. Change the error paragraph class from `error` to `ui-error`.

- [ ] **Step 2: Replace LoginPage scoped styles**

Replace the scoped style block in `src/components/LoginPage.vue` with:

```css
<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #edf0f2;
  padding: 24px;
}

.login-form {
  width: min(100%, 340px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(32, 42, 51, 0.12);
  padding: 24px;
}

.login-form h1 {
  margin: 0;
  color: var(--green-700);
  font-size: 24px;
  text-align: center;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  color: var(--muted);
  font-size: 14px;
}
</style>
```

- [ ] **Step 3: Update BookListPage template classes**

In `src/components/BookListPage.vue`:

- Change `<div class="book-list-page">` to `<div class="book-list-page app-page">`.
- Change `<div class="page-header">` to `<div class="app-page-header">`.
- Change `<div class="header-actions">` to `<div class="app-page-actions">`.
- Add `class="ui-button"` to the admin and logout buttons.
- Add `class="ui-field"` to the new book input.
- Add `class="ui-button ui-button--primary"` to the new book submit button.
- Add `class="ui-field"` to the rename input.
- Add `class="ui-button"` to open, rename, confirm rename, and cancel buttons.
- Add `class="ui-button ui-button--danger"` to the delete button.

- [ ] **Step 4: Remove BookListPage scoped styles**

Delete the scoped style block from `src/components/BookListPage.vue` because `.app-page-header` and `.app-page-actions` replace its rules.

- [ ] **Step 5: Update AdminPage template classes**

In `src/components/AdminPage.vue`:

- Change `<div class="admin-page">` to `<div class="admin-page app-page">`.
- Change `<header>` to `<header class="app-page-header">`.
- Place the `h1` first inside the header, then add `<div class="app-page-actions">` containing the back and logout buttons.
- Add `class="ui-button"` to the back and logout buttons.
- Add `class="ui-field"` to both inputs.
- Add `class="ui-select"` to the role select.
- Add `class="ui-button ui-button--primary"` to the create button.
- Change `<p v-if="error" class="error">` to `<p v-if="error" class="ui-error">`.
- Change `<table>` to `<table class="ui-table">`.
- Add `data-testid="delete-user-u1"` pattern by rendering ``:data-testid="`delete-user-${u.id}`"`` on each delete button.
- Add `class="ui-button ui-button--danger"` to each delete button.

- [ ] **Step 6: Replace AdminPage scoped styles**

Replace the scoped style block in `src/components/AdminPage.vue` with:

```css
<style scoped>
.app-page-header h1 {
  flex: 1;
}

.create-user {
  margin-bottom: 24px;
}

.create-user h2,
.user-list h2 {
  margin: 0 0 12px;
  color: var(--green-700);
  font-size: 18px;
}

.create-user form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
rtk npm run test -- src/components/BookListPage.test.ts src/components/LoginPage.test.ts src/components/AdminPage.test.ts
```

Expected: PASS.

### Task 4: Verify Build and Review Diff

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run full frontend test suite**

Run:

```bash
rtk npm run test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
rtk npm run build
```

Expected: PASS with Vite build output.

- [ ] **Step 3: Review changed files**

Run:

```bash
rtk git diff -- src/style.css src/components/LoginPage.vue src/components/BookListPage.vue src/components/AdminPage.vue src/components/BookListPage.test.ts src/components/LoginPage.test.ts src/components/AdminPage.test.ts
```

Expected: Diff contains only shared style classes, component class updates, and tests. It must not include unrelated `src/App.vue` changes.

- [ ] **Step 4: Commit implementation changes**

Run:

```bash
rtk git add src/style.css src/components/LoginPage.vue src/components/BookListPage.vue src/components/AdminPage.vue src/components/BookListPage.test.ts src/components/LoginPage.test.ts src/components/AdminPage.test.ts
rtk git commit -m "style: unify app controls"
```

Expected: Commit succeeds and leaves only the pre-existing `src/App.vue` modification unstaged.
