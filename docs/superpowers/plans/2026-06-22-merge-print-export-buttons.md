# Merge Print/Export Buttons Into Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two separate "打印整册" / "导出 MD" toolbar buttons with a single "导出 ▾" button that opens a dropdown menu offering both actions, and extract the dropdown logic that's now used by two buttons into a shared `ToolbarMenuButton.vue` component.

**Architecture:** Extract `ToolbarMenuButton.vue` — a generic dropdown wrapper that owns open/close state, outside-click/Escape dismissal, and `disabled` handling, exposing menu items via a scoped default slot (`{ close }`). Refactor the existing `GenerateMenuButton.vue` to be a thin wrapper around it (no behavior change, same public DOM contract). Add a new `ExportMenuButton.vue`, also a thin wrapper, for "打印整册"/"导出 MD". `WorkspaceToolbar.vue` swaps its two standalone buttons for `ExportMenuButton`; `WorkspaceView.vue` requires no changes.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vitest + `@vue/test-utils`, plain CSS in `src/style.css` (no UI component library).

## Global Constraints

- Button label for the merged print/export button is exactly "导出 ▾".
- Clicking the main button only toggles the dropdown; it never directly fires `print` or `export`.
- The two menu item buttons keep `data-testid="print"` and `data-testid="export"`.
- The new toggle button uses `data-testid="export-menu-toggle"`.
- The merged button is disabled as a whole (native `disabled` attribute) when `lessonCount === 0` — matching the existing per-button disabled condition on "打印整册"/"导出 MD".
- `GenerateMenuButton.vue`'s public DOM contract (testids `generate-menu-toggle`, `generate`, `batch-generate`, label "生成教案 ▾", events `generate`/`batchGenerate`) must NOT change as an observable behavior — internal implementation may change.
- `WorkspaceToolbar.vue`'s `defineEmits` block and `WorkspaceView.vue`'s event listeners must NOT change.
- Reuse existing CSS design tokens only (`var(--line)`, `var(--radius-md)`, `var(--green-100)`, `var(--green-700)`) — no new color/radius values.
- No changes to generation/print/export business logic, `BatchGenerateDialog.vue`, or `GenerateLessonDialog.vue`.

---

### Task 1: Create `ToolbarMenuButton.vue` with tests

**Files:**
- Create: `src/components/ToolbarMenuButton.vue`
- Create: `src/components/ToolbarMenuButton.test.ts`

**Interfaces:**
- Produces: `ToolbarMenuButton` component with:
  ```ts
  defineProps<{
    label: string
    toggleTestid: string
    disabled?: boolean
  }>()
  ```
  No emits — it has no domain knowledge of what actions exist. Default slot receives scope `{ close: () => void }`. Consumers render their own `<li>` menu items inside the slot and call `close()` after emitting their own event.
- DOM contract later tasks rely on:
  - Toggle button: `button[:data-testid="toggleTestid"]` (the literal value passed via the `toggleTestid` prop)
  - Root wrapper: `div.toolbar-menu`
  - Menu list (only in DOM while open): `ul.toolbar-menu-list`, rendered via `<slot :close="close" />` inside it

- [ ] **Step 1: Write the failing tests**

Create `src/components/ToolbarMenuButton.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToolbarMenuButton from './ToolbarMenuButton.vue'

function mountMenu(props: { label: string; toggleTestid: string; disabled?: boolean }) {
  return mount(ToolbarMenuButton, {
    props,
    attachTo: document.body,
    slots: {
      default: `<template #default="{ close }">
        <li role="menuitem"><button data-testid="item-a" @click="close">Item A</button></li>
        <li role="menuitem"><button data-testid="item-b" @click="close">Item B</button></li>
      </template>`,
    },
  })
}

describe('ToolbarMenuButton', () => {
  it('renders the toggle button with the given label and closed menu by default', () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    expect(wrapper.get('button[data-testid="export-menu-toggle"]').text()).toBe('导出 ▾')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the menu when the toggle button is clicked', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="item-a"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-testid="item-b"]').isVisible()).toBe(true)
    wrapper.unmount()
  })

  it('closes the menu when a slot item calls close', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="item-a"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when clicking outside the component', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(true)

    document.body.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes the menu when Escape is pressed', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle' })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(true)

    await wrapper.get('div.toolbar-menu').trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables the toggle button and never opens the menu when disabled is true', async () => {
    const wrapper = mountMenu({ label: '导出 ▾', toggleTestid: 'export-menu-toggle', disabled: true })
    expect(wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled')).toBeDefined()
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="item-a"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ToolbarMenuButton.test.ts`
Expected: FAIL — `Failed to resolve import "./ToolbarMenuButton.vue"` (file doesn't exist yet).

- [ ] **Step 3: Write the component implementation**

Create `src/components/ToolbarMenuButton.vue`:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{
  label: string
  toggleTestid: string
  disabled?: boolean
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
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
  <div ref="rootRef" class="toolbar-menu" @keydown="handleKeydown">
    <button
      type="button"
      :data-testid="toggleTestid"
      :disabled="disabled"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      {{ label }}
    </button>
    <ul v-if="open" class="toolbar-menu-list" role="menu">
      <slot :close="close" />
    </ul>
  </div>
</template>
```

Note: a native `disabled` button never dispatches `click` events, so `toggle()` cannot run while `disabled` is true — no extra guard needed in `toggle()` itself.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ToolbarMenuButton.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ToolbarMenuButton.vue src/components/ToolbarMenuButton.test.ts
git commit -m "feat: add generic ToolbarMenuButton dropdown component"
```

---

### Task 2: Refactor `GenerateMenuButton.vue` to use `ToolbarMenuButton`

**Files:**
- Modify: `src/components/GenerateMenuButton.vue` (full rewrite, ~21 lines)
- Modify: `src/components/GenerateMenuButton.test.ts:54` (one assertion)

**Interfaces:**
- Consumes: `ToolbarMenuButton` from Task 1 — props `label`, `toggleTestid`, `disabled?`; default slot scope `{ close }`.
- Produces: `GenerateMenuButton` keeps emitting `generate` / `batchGenerate` exactly as before, with identical DOM contract (`generate-menu-toggle`, `generate`, `batch-generate`, label "生成教案 ▾"). No prior consumer of `GenerateMenuButton` (i.e. `WorkspaceToolbar.vue`) needs to change.

This task is a pure refactor: the existing `GenerateMenuButton.test.ts` (6 tests, unchanged behavior asserted through testids) must still pass except for the one assertion that inspects the internal root class name.

- [ ] **Step 1: Update the one test assertion that touches internal implementation**

In `src/components/GenerateMenuButton.test.ts`, line 54 currently reads:

```ts
    await wrapper.get('div.generate-menu').trigger('keydown', { key: 'Escape' })
```

Change it to:

```ts
    await wrapper.get('div.toolbar-menu').trigger('keydown', { key: 'Escape' })
```

- [ ] **Step 2: Run the existing test to verify it fails for the expected reason**

Run: `npx vitest run src/components/GenerateMenuButton.test.ts`
Expected: FAIL on `closes the menu when Escape is pressed` — `div.toolbar-menu` does not exist yet (component still renders `div.generate-menu`). The other 5 tests still pass at this point since the component hasn't changed yet.

- [ ] **Step 3: Rewrite the component to wrap `ToolbarMenuButton`**

Replace the full contents of `src/components/GenerateMenuButton.vue` with:

```vue
<script setup lang="ts">
import ToolbarMenuButton from './ToolbarMenuButton.vue'

const emit = defineEmits<{
  generate: []
  batchGenerate: []
}>()
</script>

<template>
  <ToolbarMenuButton label="生成教案 ▾" toggle-testid="generate-menu-toggle">
    <template #default="{ close }">
      <li role="menuitem">
        <button
          type="button"
          data-testid="batch-generate"
          @click="
            emit('batchGenerate')
            close()
          "
        >
          批量生成
        </button>
      </li>
      <li role="menuitem">
        <button
          type="button"
          data-testid="generate"
          @click="
            emit('generate')
            close()
          "
        >
          生成一篇
        </button>
      </li>
    </template>
  </ToolbarMenuButton>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/GenerateMenuButton.test.ts`
Expected: PASS (6 tests) — identical behavior, now backed by `ToolbarMenuButton`.

Also run the consumers to confirm no regression:
Run: `npx vitest run src/components/WorkspaceToolbar.test.ts src/components/WorkspaceView.test.ts`
Expected: same pass/fail counts as before this task (the 3 pre-existing unrelated `WorkspaceView.test.ts` failures about file-upload placeholder text and batch-generate concurrency ordering are unaffected; `WorkspaceToolbar.test.ts` fully passes).

- [ ] **Step 5: Commit**

```bash
git add src/components/GenerateMenuButton.vue src/components/GenerateMenuButton.test.ts
git commit -m "refactor: rebuild GenerateMenuButton on top of ToolbarMenuButton"
```

---

### Task 3: Create `ExportMenuButton.vue` with tests

**Files:**
- Create: `src/components/ExportMenuButton.vue`
- Create: `src/components/ExportMenuButton.test.ts`

**Interfaces:**
- Consumes: `ToolbarMenuButton` from Task 1.
- Produces: `ExportMenuButton` component:
  ```ts
  defineProps<{ disabled?: boolean }>()
  defineEmits<{ print: []; export: [] }>()
  ```
  DOM contract: toggle `button[data-testid="export-menu-toggle"]` with label "导出 ▾"; menu items `button[data-testid="print"]` ("打印整册") and `button[data-testid="export"]` ("导出 MD"), only present while the dropdown is open.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ExportMenuButton.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ExportMenuButton from './ExportMenuButton.vue'

describe('ExportMenuButton', () => {
  it('renders the toggle button with the menu closed by default', () => {
    const wrapper = mount(ExportMenuButton, { attachTo: document.body })
    expect(wrapper.get('button[data-testid="export-menu-toggle"]').text()).toContain('导出')
    expect(wrapper.find('[data-testid="print"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits print and closes the menu when "打印整册" is clicked', async () => {
    const wrapper = mount(ExportMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="print"]').trigger('click')
    expect(wrapper.emitted('print')).toHaveLength(1)
    expect(wrapper.find('[data-testid="print"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('emits export and closes the menu when "导出 MD" is clicked', async () => {
    const wrapper = mount(ExportMenuButton, { attachTo: document.body })
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="export"]').trigger('click')
    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.find('[data-testid="export"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables the toggle button when disabled prop is true', () => {
    const wrapper = mount(ExportMenuButton, {
      props: { disabled: true },
      attachTo: document.body,
    })
    expect(
      wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('keeps the toggle button enabled when disabled prop is false', () => {
    const wrapper = mount(ExportMenuButton, {
      props: { disabled: false },
      attachTo: document.body,
    })
    expect(
      wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled'),
    ).toBeUndefined()
    wrapper.unmount()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/ExportMenuButton.test.ts`
Expected: FAIL — `Failed to resolve import "./ExportMenuButton.vue"` (file doesn't exist yet).

- [ ] **Step 3: Write the component implementation**

Create `src/components/ExportMenuButton.vue`:

```vue
<script setup lang="ts">
import ToolbarMenuButton from './ToolbarMenuButton.vue'

defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{
  print: []
  export: []
}>()
</script>

<template>
  <ToolbarMenuButton label="导出 ▾" toggle-testid="export-menu-toggle" :disabled="disabled">
    <template #default="{ close }">
      <li role="menuitem">
        <button
          type="button"
          data-testid="print"
          @click="
            emit('print')
            close()
          "
        >
          打印整册
        </button>
      </li>
      <li role="menuitem">
        <button
          type="button"
          data-testid="export"
          @click="
            emit('export')
            close()
          "
        >
          导出 MD
        </button>
      </li>
    </template>
  </ToolbarMenuButton>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/ExportMenuButton.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ExportMenuButton.vue src/components/ExportMenuButton.test.ts
git commit -m "feat: add ExportMenuButton dropdown component"
```

---

### Task 4: Wire `ExportMenuButton` into `WorkspaceToolbar.vue`

**Files:**
- Modify: `src/components/WorkspaceToolbar.vue`
- Modify: `src/components/WorkspaceToolbar.test.ts`
- Modify: `src/components/WorkspaceView.test.ts:207`

**Interfaces:**
- Consumes: `ExportMenuButton` from Task 3 — props `disabled?`, events `print`/`export`, testids `export-menu-toggle`/`print`/`export`.
- Produces: `WorkspaceToolbar` keeps emitting `print` and `export` exactly as before — no change to its own `defineEmits` block or to how `WorkspaceView.vue` listens to it.

- [ ] **Step 1: Write the failing tests**

In `src/components/WorkspaceToolbar.test.ts`, replace the `disables print, export and clear when there are no lessons` test (currently the last test in the file, asserting on `data-testid="print"` / `"export"` directly) with:

```ts
  it('disables the export menu toggle and clear button when there are no lessons', () => {
    const wrapper = mountToolbar(0)
    expect(
      wrapper.get('button[data-testid="export-menu-toggle"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.get('button[data-testid="clear"]').attributes('disabled')).toBeDefined()
  })

  it('emits print when the print menu item is clicked', async () => {
    const wrapper = mountToolbar(3)
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="print"]').trigger('click')
    expect(wrapper.emitted('print')).toHaveLength(1)
  })

  it('emits export when the export menu item is clicked', async () => {
    const wrapper = mountToolbar(3)
    await wrapper.get('button[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('button[data-testid="export"]').trigger('click')
    expect(wrapper.emitted('export')).toHaveLength(1)
  })
```

(Keep every other existing test in the file unchanged.)

In `src/components/WorkspaceView.test.ts`, line 207 currently reads:

```ts
    await wrapper.get('[data-testid="export"]').trigger('click')
```

Change it to:

```ts
    await wrapper.get('[data-testid="export-menu-toggle"]').trigger('click')
    await wrapper.get('[data-testid="export"]').trigger('click')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/WorkspaceToolbar.test.ts src/components/WorkspaceView.test.ts`
Expected: FAIL — `export-menu-toggle` testid not found (toolbar still has the old two standalone buttons).

- [ ] **Step 3: Update the toolbar template**

In `src/components/WorkspaceToolbar.vue`, add the import in `<script setup>` alongside the existing `GenerateMenuButton` import:

```ts
import ExportMenuButton from './ExportMenuButton.vue'
```

Replace the two lines:

```vue
    <button type="button" data-testid="print" :disabled="lessonCount === 0" @click="$emit('print')">打印整册</button>
    <button type="button" data-testid="export" :disabled="lessonCount === 0" @click="$emit('export')">导出 MD</button>
```

with:

```vue
    <ExportMenuButton :disabled="lessonCount === 0" @print="$emit('print')" @export="$emit('export')" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/WorkspaceToolbar.test.ts src/components/WorkspaceView.test.ts`
Expected: PASS for `WorkspaceToolbar.test.ts` (all tests); `WorkspaceView.test.ts` shows the same pre-existing 3 unrelated failures as before this task (file-upload placeholder text, batch-generate concurrency ordering) and no new failures.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkspaceToolbar.vue src/components/WorkspaceToolbar.test.ts src/components/WorkspaceView.test.ts
git commit -m "feat: merge print/export buttons into a single dropdown in WorkspaceToolbar"
```

---

### Task 5: Rename CSS classes from `generate-menu` to generic `toolbar-menu`

**Files:**
- Modify: `src/style.css:273-307` (the three `.generate-menu*` rules)
- Modify: `src/style.css:778-780` (the mobile media-query rule)

**Interfaces:**
- Consumes: class names `toolbar-menu` / `toolbar-menu-list` already rendered by `ToolbarMenuButton.vue` (Task 1).
- Produces: a single shared style block used by both `GenerateMenuButton` and `ExportMenuButton` — no per-button duplication.

- [ ] **Step 1: Rename the dropdown style block**

In `src/style.css`, replace lines 273-307:

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

with:

```css
.toolbar-menu {
  position: relative;
  display: inline-flex;
}

.toolbar-menu-list {
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

.toolbar-menu-list button {
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

.toolbar-menu-list button:hover {
  background: var(--green-100);
}
```

- [ ] **Step 2: Rename the mobile media-query rule**

In `src/style.css`, inside the `@media (max-width: 600px)` block, replace:

```css
  .workspace-toolbar .generate-menu {
    flex: 0 0 auto;
  }
```

with:

```css
  .workspace-toolbar .toolbar-menu {
    flex: 0 0 auto;
  }
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS for all suites except the 5 pre-existing, unrelated failures (3 in `WorkspaceView.test.ts` about file-upload placeholder text and batch-generate concurrency ordering, 2 in `useTeachingBook.test.ts` about `store.importFiles`) — CSS changes don't affect Vitest/jsdom assertions; this is a safety check that nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style: rename generate-menu CSS classes to generic toolbar-menu"
```
