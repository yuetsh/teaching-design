# Frontend Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-backed frontend routes for login, book list, book workspace, and admin.

**Architecture:** Keep route ownership in `src/App.vue` and leave page components event-driven. Use `window.history.pushState`, `window.history.replaceState`, and `popstate` to maintain one small local route state without adding dependencies.

**Tech Stack:** Vue 3 Composition API, Vite, Vitest, Vue Test Utils, browser History API.

---

## File Structure

- Modify `src/App.test.ts` for TDD coverage of URL-backed navigation and logged-out redirects.
- Modify `src/App.vue` to replace local `currentBookId` / `showAdmin` view state with parsed route state.
- Do not modify `package.json` or `package-lock.json`; existing user changes there are unrelated.

## Task 1: Add failing route tests

**Files:**
- Modify: `src/App.test.ts`
- Test: `src/App.test.ts`

- [ ] **Step 1: Replace the auth mock with mutable test state**

Use a hoisted auth state so each test can switch between logged-in and logged-out behavior:

```ts
const authState = vi.hoisted(() => {
  const { computed, ref } = require('vue') as typeof import('vue')
  return {
    loggedIn: ref(true),
    user: ref(null),
    fetchMe: vi.fn(),
  }
})

vi.mock('./composables/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: computed(() => authState.loggedIn.value),
    fetchMe: authState.fetchMe,
    user: authState.user,
  }),
}))
```

- [ ] **Step 2: Reset URL and auth state before each test**

Add this to the existing `beforeEach`:

```ts
authState.loggedIn.value = true
authState.user.value = null
authState.fetchMe.mockReset()
window.history.replaceState(null, '', '/books')
```

- [ ] **Step 3: Add tests for the route behaviors**

Add these tests:

```ts
it('opens a book route when a book is selected', async () => {
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

  expect(window.location.pathname).toBe('/books/b1')
  expect(wrapper.find('[data-testid="back"]').exists()).toBe(true)
})

it('returns to the books route from the workspace', async () => {
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

  expect(window.location.pathname).toBe('/books')
  expect(wrapper.text()).toContain('教学设计')
})

it('opens the admin route from the book list', async () => {
  authState.user.value = { id: 'u1', username: 'admin', role: 'admin' }
  vi.mocked(booksApi.listBooks).mockResolvedValue([])

  const wrapper = mount(App)
  await flushPromises()

  await wrapper.get('button').trigger('click')
  await flushPromises()

  expect(window.location.pathname).toBe('/admin')
  expect(wrapper.text()).toContain('用户管理')
})

it('routes logged-out users to login', async () => {
  authState.loggedIn.value = false
  window.history.replaceState(null, '', '/books/b1')

  const wrapper = mount(App)
  await flushPromises()

  expect(window.location.pathname).toBe('/login')
  expect(wrapper.text()).toContain('登录')
})
```

- [ ] **Step 4: Run test to verify RED**

Run:

```bash
rtk npm test -- src/App.test.ts
```

Expected: FAIL because `App.vue` does not update `window.location.pathname` for book/admin navigation and does not redirect logged-out users.

## Task 2: Implement route state in App.vue

**Files:**
- Modify: `src/App.vue`
- Test: `src/App.test.ts`

- [ ] **Step 1: Replace local page flags with route state**

In `src/App.vue`, replace `currentBookId` and `showAdmin` with this route model:

```ts
type AppRoute =
  | { name: 'login' }
  | { name: 'books' }
  | { name: 'book'; bookId: string }
  | { name: 'admin' }

const route = ref<AppRoute>(parseRoute(window.location.pathname))
```

- [ ] **Step 2: Add route parsing and navigation helpers**

Add helpers in `src/App.vue`:

```ts
function parseRoute(pathname: string): AppRoute {
  if (pathname === '/login') return { name: 'login' }
  if (pathname === '/admin') return { name: 'admin' }
  if (pathname === '/books') return { name: 'books' }

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/)
  if (bookMatch?.[1]) {
    return { name: 'book', bookId: decodeURIComponent(bookMatch[1]) }
  }

  return { name: 'books' }
}

function routeToPath(nextRoute: AppRoute): string {
  if (nextRoute.name === 'login') return '/login'
  if (nextRoute.name === 'admin') return '/admin'
  if (nextRoute.name === 'book') return `/books/${encodeURIComponent(nextRoute.bookId)}`
  return '/books'
}

function replaceRoute(nextRoute: AppRoute): void {
  const path = routeToPath(nextRoute)
  route.value = nextRoute
  if (window.location.pathname !== path) {
    window.history.replaceState(null, '', path)
  }
}

function pushRoute(nextRoute: AppRoute): void {
  const path = routeToPath(nextRoute)
  route.value = nextRoute
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
  }
}
```

- [ ] **Step 3: Wire mount, popstate, and auth redirects**

Update imports and lifecycle:

```ts
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
```

Use:

```ts
function syncRouteForAuth(): void {
  if (!isLoggedIn.value) {
    replaceRoute({ name: 'login' })
    return
  }
  if (route.value.name === 'login') {
    replaceRoute({ name: 'books' })
  }
}

function handlePopState(): void {
  route.value = parseRoute(window.location.pathname)
  syncRouteForAuth()
}

onMounted(async () => {
  window.addEventListener('popstate', handlePopState)
  await fetchMe()
  syncRouteForAuth()
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
})

watch(isLoggedIn, syncRouteForAuth)
```

- [ ] **Step 4: Map existing component events to route navigation**

Use:

```ts
async function handleLoginSuccess(): Promise<void> {
  await fetchMe()
  pushRoute({ name: 'books' })
}

function openBook(id: string): void {
  pushRoute({ name: 'book', bookId: id })
}

function backToList(): void {
  pushRoute({ name: 'books' })
}

function openAdmin(): void {
  pushRoute({ name: 'admin' })
}
```

- [ ] **Step 5: Update template route conditions**

Use:

```vue
<LoginPage v-if="route.name === 'login'" @success="handleLoginSuccess" />
<template v-else>
  <AdminPage v-if="route.name === 'admin'" @back="backToList" />
  <WorkspaceView
    v-else-if="route.name === 'book'"
    :key="route.bookId"
    :book-id="route.bookId"
    @back="backToList"
  />
  <BookListPage v-else @open="openBook" @admin="openAdmin" />
</template>
```

- [ ] **Step 6: Run test to verify GREEN**

Run:

```bash
rtk npm test -- src/App.test.ts
```

Expected: PASS for all `App.test.ts` cases.

## Task 3: Final verification

**Files:**
- Verify: `src/App.vue`
- Verify: `src/App.test.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
rtk npm test -- src/App.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full frontend test suite**

Run:

```bash
rtk npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
rtk npm run build
```

Expected: PASS.

- [ ] **Step 4: Review git diff**

Run:

```bash
rtk git diff -- src/App.vue src/App.test.ts docs/superpowers/plans/2026-06-16-frontend-routing.md
```

Expected: diff only contains routing implementation, routing tests, and this plan.
