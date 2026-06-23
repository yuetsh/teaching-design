# Merge Generate Buttons Into Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two separate "批量生成" / "生成一篇" toolbar buttons with a single "生成教案 ▾" button that opens a dropdown menu offering both actions.

**Architecture:** Extract a new self-contained Vue component `GenerateMenuButton.vue` that owns the open/closed state and outside-click/Escape dismissal, and emits the same `generate` / `batchGenerate` events the toolbar already emits today. `WorkspaceToolbar.vue` swaps its two `<button>` elements for this component and forwards its events unchanged, so `WorkspaceView.vue` requires no changes at all.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vitest + `@vue/test-utils` for component tests, plain CSS (no UI component library) in `src/style.css`.

## Global Constraints

- Button label for the merged button is exactly "生成教案 ▾" (text "生成教案" + a down-caret).
- Clicking the main button only toggles the dropdown; it never directly fires `generate` or `batchGenerate`.
- The two menu item buttons keep their existing `data-testid` values: `data-testid="generate"` and `data-testid="batch-generate"`.
- The new toggle button uses `data-testid="generate-menu-toggle"`.
- `WorkspaceToolbar`'s public `defineEmits` (`generate`, `batchGenerate`, plus the other existing events) and `WorkspaceView.vue`'s `@generate` / `@batch-generate` listeners must NOT change.
- Reuse existing CSS design tokens (`var(--line)`, `var(--radius-md)`, `var(--green-100)`, `var(--green-600)`) — do not introduce new color/radius values.
- No changes to `BatchGenerateDialog.vue`, `GenerateLessonDialog.vue`, or any generation/API logic.

---

### Task 1: Create `GenerateMenuButton.vue` with tests

**Files:**
- Create: `src/components/GenerateMenuButton.vue`
- Create: `src/components/GenerateMenuButton.test.ts`

**Interfaces:**
- Produces: `GenerateMenuButton` component with `defineEmits<{ generate: []; batchGenerate: [] }>()`. No props. Default export is the `.vue` SFC, imported as `import GenerateMenuButton from './GenerateMenuButton.vue'`.
- DOM contract later tasks rely on:
  - Toggle button: `button[data-testid="generate-menu-toggle"]`
  - Menu item buttons (only present in DOM while menu is open): `button[data-testid="generate"]`, `button[data-testid="batch-generate"]`
  - Menu list root: `ul.generate-menu-list`
  - Component root wrapper: `div.generate-menu`

- [ ] **Step 1: Write the failing tests**

Create `src/components/GenerateMenuButton.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GenerateMenuButton from './GenerateMenuButton.vue'

describe('GenerateMenuButton', () => {
  it('renders the toggle button with the menu closed by default', () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    expect(wrapper.get('button[data-testid="generate-menu-toggle"]').text()).toContain('生成教案')
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="batch-generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the menu when the toggle button is clicked', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="generate"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="batch-generate"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('emits generate and closes the menu when "生成一篇" is clicked', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="generate"]').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits batchGenerate and closes the menu when "批量生成" is clicked', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="batch-generate"]').trigger('click')
    expect(wrapper.emitted('batchGenerate')).toHaveLength(1)
    expect(wrapper.find('[data-testid="batch-generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when clicking outside the component', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(true)

    document.body.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when Escape is pressed', async () => {
    const wrapper = mount(GenerateMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(true)

    await wrapper.get('div.generate-menu').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[data-testid="generate"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/GenerateMenuButton.test.ts`
Expected: FAIL — `Failed to resolve import "./GenerateMenuButton.vue"` (file doesn't exist yet).

- [ ] **Step 3: Write the component implementation**

Create `src/components/GenerateMenuButton.vue`:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  generate: []
  batchGenerate: []
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function select(action: 'generate' | 'batchGenerate'): void {
  emit(action)
  close()
}

function handleDocumentClick(event: MouseEvent): void {
  if (!rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) {
    close()
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div ref="rootRef" class="generate-menu" @keydown="handleKeydown">
    <button
      type="button"
      data-testid="generate-menu-toggle"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      生成教案 ▾
    </button>
    <ul v-if="open" class="generate-menu-list" role="menu">
      <li role="menuitem">
        <button type="button" data-testid="generate" @click="select('generate')">生成一篇</button>
      </li>
      <li role="menuitem">
        <button type="button" data-testid="batch-generate" @click="select('batchGenerate')">
          批量生成
        </button>
      </li>
    </ul>
  </div>
</template>
```

Note: `@click.stop` on the toggle button prevents the same click that opens the menu from also being seen by `handleDocumentClick` as an "outside" click (the document listener is registered on `document`, and Vue's synthetic click on the button would otherwise bubble to it in the same tick before `open` is read — `.stop` keeps behavior deterministic regardless of listener order).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/GenerateMenuButton.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/GenerateMenuButton.vue src/components/GenerateMenuButton.test.ts
git commit -m "feat: add GenerateMenuButton dropdown component"
```

---

### Task 2: Wire `GenerateMenuButton` into `WorkspaceToolbar.vue`

**Files:**
- Modify: `src/components/WorkspaceToolbar.vue:1-32`
- Modify: `src/components/WorkspaceToolbar.test.ts`

**Interfaces:**
- Consumes: `GenerateMenuButton` from Task 1, with events `generate` and `batchGenerate`, and DOM testids `generate-menu-toggle`, `generate`, `batch-generate` (only present once toggled open).
- Produces: `WorkspaceToolbar` keeps emitting `generate` and `batchGenerate` exactly as before — no change to its own `defineEmits` block or to how `WorkspaceView.vue` listens to it.

- [ ] **Step 1: Write the failing tests**

Update `src/components/WorkspaceToolbar.test.ts` — replace the existing `generate`-related tests (lines 17-21 and 29-33) with versions that open the dropdown first:

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

  it('emits generate when the generate menu item is clicked', async () => {
    const wrapper = mountToolbar(3)
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="generate"]').trigger('click')
    expect(wrapper.emitted('generate')).toHaveLength(1)
  })

  it('emits batchGenerate when the batch-generate menu item is clicked', async () => {
    const wrapper = mountToolbar(3)
    await wrapper.get('button[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="batch-generate"]').trigger('click')
    expect(wrapper.emitted('batchGenerate')).toHaveLength(1)
  })

  it('emits back when the back button is clicked', async () => {
    const wrapper = mountToolbar(0)
    await wrapper.get('button[data-testid="back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('keeps the generate menu toggle and back button enabled even with no lessons', () => {
    const wrapper = mountToolbar(0)
    expect(
      wrapper.get('button[data-testid="generate-menu-toggle"]').attributes('disabled'),
    ).toBeUndefined()
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/WorkspaceToolbar.test.ts`
Expected: FAIL — `generate-menu-toggle` testid not found (toolbar still has the old two buttons).

- [ ] **Step 3: Update the toolbar template**

In `src/components/WorkspaceToolbar.vue`, add the import at the top of the `<script setup>` block (after the existing `SaveStatus` import on line 2):

```ts
import GenerateMenuButton from './GenerateMenuButton.vue'
```

Replace lines 31-32:

```vue
    <button type="button" data-testid="batch-generate" @click="$emit('batchGenerate')">批量生成</button>
    <button type="button" data-testid="generate" @click="$emit('generate')">生成一篇</button>
```

with:

```vue
    <GenerateMenuButton @generate="$emit('generate')" @batch-generate="$emit('batchGenerate')" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/WorkspaceToolbar.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkspaceToolbar.vue src/components/WorkspaceToolbar.test.ts
git commit -m "feat: merge generate buttons into a single dropdown in WorkspaceToolbar"
```

---

### Task 3: Update `WorkspaceView.test.ts` for the new dropdown flow

**Files:**
- Modify: `src/components/WorkspaceView.test.ts:95` and `:131`

**Interfaces:**
- Consumes: `data-testid="generate-menu-toggle"` from `GenerateMenuButton` (Task 1), rendered inside `WorkspaceToolbar` (Task 2) which is rendered inside `WorkspaceView`.

- [ ] **Step 1: Run the existing suite to confirm the current failure**

Run: `npx vitest run src/components/WorkspaceView.test.ts`
Expected: FAIL on the two tests that click `[data-testid="generate"]` / `[data-testid="batch-generate"]` directly, because those buttons are no longer in the DOM until the dropdown is opened (`TestingLibraryElementError`-style "unable to find" error from `wrapper.get`).

- [ ] **Step 2: Update the two call sites**

In `src/components/WorkspaceView.test.ts`, change line 95 from:

```ts
    await wrapper.get('[data-testid="generate"]').trigger('click')
```

to:

```ts
    await wrapper.get('[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('[data-testid="generate"]').trigger('click')
```

And change line 131 from:

```ts
    await wrapper.get('[data-testid="batch-generate"]').trigger('click')
```

to:

```ts
    await wrapper.get('[data-testid="generate-menu-toggle"]').trigger('click')
    await wrapper.get('[data-testid="batch-generate"]').trigger('click')
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/components/WorkspaceView.test.ts`
Expected: PASS (all tests in the file, including the two updated ones).

- [ ] **Step 4: Commit**

```bash
git add src/components/WorkspaceView.test.ts
git commit -m "test: open the generate dropdown before clicking generate actions in WorkspaceView tests"
```

---

### Task 4: Style the dropdown menu

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: existing design tokens `var(--line)`, `var(--radius-md)`, `var(--green-100)`, `var(--green-600)` (already defined elsewhere in `src/style.css`); existing selector `.workspace-toolbar button` (`src/style.css:251-264`) which still applies to the toggle button and menu item buttons since they are descendants of `.workspace-toolbar`.
- Produces: `.generate-menu`, `.generate-menu-list` classes used by `GenerateMenuButton.vue` (Task 1).

- [ ] **Step 1: Add the dropdown styles**

In `src/style.css`, immediately after the `.workspace-toolbar button:disabled` rule (after line 271, before the `.workspace-toolbar-count` block at line 273), insert:

```css
.generate-menu {
  position: relative;
  display: inline-flex;
}

.generate-menu-list {
  position: absolute;
  top: 100%;
  left: 0;
  margin: 4px 0 0;
  padding: 4px;
  min-width: 120px;
  list-style: none;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.generate-menu-list button {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  padding: 8px 12px;
  text-align: left;
  color: var(--green-700);
  cursor: pointer;
}

.generate-menu-list button:hover {
  background: var(--green-100);
}
```

- [ ] **Step 2: Make the dropdown wrapper behave like a toolbar button at narrow widths**

In `src/style.css`, inside the existing `@media (max-width: 600px)` block (`src/style.css:729-745`), add a rule next to `.workspace-toolbar button { flex: 0 0 auto; }`:

```css
  .workspace-toolbar .generate-menu {
    flex: 0 0 auto;
  }
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS — all existing suites (including `WorkspaceToolbar.test.ts`, `WorkspaceView.test.ts`, `GenerateMenuButton.test.ts`) still pass. CSS changes don't affect Vitest/jsdom assertions, this is a safety check that nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style: add dropdown styling for the merged generate menu button"
```
