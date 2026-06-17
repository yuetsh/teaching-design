# UI Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the changes in `docs/superpowers/specs/2026-06-16-ui-detail-polish-design.md` — radius/spacing design tokens, subtle interaction feedback (hover/active/focus-visible), and a mobile workspace-toolbar wrapping fix.

**Architecture:** This is a CSS-only change set, almost entirely confined to `src/style.css`, plus one selector update in `src/components/LoginPage.vue`'s `<style scoped>` block. There is no component markup or behavior change, and no new dependencies.

**Tech Stack:** Vue 3 + TypeScript (Vite + Bun), plain CSS (no preprocessor, no CSS framework).

## Global Constraints

- No markup or `<script>` changes in any `.vue` file — CSS only.
- Do not touch `src/print.css` or the A4 canvas layout (`.page`, `.a4-workspace`, `.a4-paper`).
- Do not replace `window.confirm()` with the `.dialog` component anywhere (out of scope, separate future spec).
- No new npm/bun dependencies, no icon or animation libraries.
- This repo has no component test files (`bun run test` runs `vitest run` with zero test files — confirmed before writing this plan). The testable deliverable for each task is: `bun run build` passes (type-check via `vue-tsc -b` + Vite build) AND a manual visual check in the browser matches the description in that task.
- Dev server: `bun run dev` (Vite on `http://localhost:5173/`). It was already running on port 5173 at the time this plan was written — check before starting a new one (`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/`).
- Admin login credentials for manual checks (from `.env`): `admin` / `admin123`.
- Make one commit per task, after its build+visual check passes.

---

### Task 1: Radius and spacing tokens

**Files:**
- Modify: `src/style.css:1-14` (`:root` block), and every line listed below in the same file.
- Modify: `src/components/LoginPage.vue:76-86` (`.login-form` rule in `<style scoped>`)

**Interfaces:**
- Produces: CSS custom properties `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6` on `:root` in `src/style.css`. Every later task in this plan may reference these by name.

- [ ] **Step 1: Add the token block to `:root`**

In `src/style.css`, the current `:root` block is:

```css
:root {
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #202a33;
  background: #edf0f2;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --green-700: #216447;
  --green-600: #2d7a58;
  --green-100: #dceee5;
  --line: #cfd5da;
  --muted: #68747f;
  --paper-width: 210mm;
  --paper-min-height: 297mm;
}
```

Replace it with:

```css
:root {
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #202a33;
  background: #edf0f2;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --green-700: #216447;
  --green-600: #2d7a58;
  --green-100: #dceee5;
  --line: #cfd5da;
  --muted: #68747f;
  --paper-width: 210mm;
  --paper-min-height: 297mm;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-pill: 999px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
}
```

- [ ] **Step 2: Swap every hardcoded `border-radius` value onto the matching token (like-for-like, no visual change)**

Make these exact replacements in `src/style.css` (line numbers are pre-edit; re-find by selector if they've shifted from Step 1):

| Line | Selector | Before | After |
|---|---|---|---|
| 72 | `.ui-button` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |
| 114 | `.ui-field,`<br>`.ui-select` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |
| 186 | `.workspace-toolbar button` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |
| 288 | `.lesson-sidebar-badge` | `border-radius: 999px;` | `border-radius: var(--radius-pill);` |
| 430 | `.process-step-actions button` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 446 | `.board-design` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 456 | `.warning-summary` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 472 | `.editable-text` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 507 | `.markdown-preview` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 532 | `.markdown-source` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 551 | `.upload-dropzone` | `border-radius: 12px;` | `border-radius: var(--radius-xl);` |
| 569 | `.upload-dropzone--compact` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |
| 603 | `.dialog` | `border-radius: 8px;` | `border-radius: var(--radius-lg);` |
| 625 | `.dialog-actions button` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |
| 648 | `.app-notice button` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 697 | `.dialog input` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |
| 718 | `.book-list-item` | `border-radius: 8px;` | `border-radius: var(--radius-lg);` |
| 741 | `.batch-topics-input` | `border-radius: 6px;` | `border-radius: var(--radius-md);` |

Leave `.batch-progress-bar` and `.batch-progress-fill` (`border-radius: 3px`) unchanged — 3px isn't on the new scale and isn't called out in the spec.

- [ ] **Step 3: Swap the radius in `LoginPage.vue`**

In `src/components/LoginPage.vue`, inside `<style scoped>`, change:

```css
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
```

to:

```css
.login-form {
  width: min(100%, 340px);
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 18px rgba(32, 42, 51, 0.12);
  padding: 24px;
}
```

- [ ] **Step 4: Snap the three off-grid spacing values**

In `src/components/LoginPage.vue`, change `.field`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

to:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
```

In `src/style.css`, change `.ui-table th, .ui-table td`:

```css
.ui-table th,
.ui-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}
```

to:

```css
.ui-table th,
.ui-table td {
  text-align: left;
  padding: var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--line);
}
```

In `src/style.css`, change `.objective-row`:

```css
.objective-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
```

to:

```css
.objective-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
```

- [ ] **Step 5: Build and verify no visual regression**

Run: `bun run build`
Expected: exits 0, no TypeScript or Vue compiler errors.

Then, with the dev server running at `http://localhost:5173/`, open the app in a browser and compare against the pre-change appearance (radius values are identical, so nothing should look different):
- Login page (`/`): card corners, input corners.
- Book list and admin page (login as `admin`/`admin123`): buttons, table.
- Open a lesson workspace: toolbar buttons, sidebar badge, editable text fields, dialogs (e.g. open the batch-generate dialog).

Confirm visually that nothing shifted except the three intentional spacing snaps (table cell padding, login field label gap, objective row gap — all changed by at most 2px and should not be perceptible as broken).

- [ ] **Step 6: Commit**

```bash
git add src/style.css src/components/LoginPage.vue
git commit -m "feat: add radius/spacing design tokens and apply across styles"
```

---

### Task 2: Transitions and active states on buttons/editable elements

**Files:**
- Modify: `src/style.css` (selectors listed below)

**Interfaces:**
- Consumes: `--green-100`, `--green-600`, `--green-700` (existing tokens).
- Produces: every button-like selector listed below now has a `transition` declaration and an `:active:not(:disabled)` rule. Task 3 will add `:focus-visible` to the same selector group — keep the group identical so the two tasks compose cleanly: `.ui-button`, `.workspace-toolbar button`, `.dialog-actions button`, `.process-step-actions button`.

- [ ] **Step 1: Add transitions to button selectors**

In `src/style.css`, change:

```css
.ui-button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  color: var(--green-700);
  cursor: pointer;
  white-space: nowrap;
}
```

to:

```css
.ui-button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  color: var(--green-700);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
```

Change:

```css
.workspace-toolbar button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  color: var(--green-700);
  cursor: pointer;
}
```

to:

```css
.workspace-toolbar button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  color: var(--green-700);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
```

Change:

```css
.dialog-actions button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  cursor: pointer;
}
```

to:

```css
.dialog-actions button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
```

Change:

```css
.process-step-actions button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-size: 12px;
  cursor: pointer;
  color: #c0392b;
}
```

to:

```css
.process-step-actions button {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-size: 12px;
  cursor: pointer;
  color: #c0392b;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
```

Change:

```css
.editable-text {
  display: block;
  width: 100%;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  background: transparent;
  resize: none;
  overflow: hidden;
}
```

to:

```css
.editable-text {
  display: block;
  width: 100%;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  background: transparent;
  resize: none;
  overflow: hidden;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
```

Change:

```css
.markdown-preview {
  min-height: 1.6em;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: text;
}
```

to:

```css
.markdown-preview {
  min-height: 1.6em;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: text;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
```

- [ ] **Step 2: Add `:active:not(:disabled)` feedback to button selectors**

Add this new rule directly after the `.ui-button--danger:hover:not(:disabled)` rule (currently ending around line 109):

```css
.ui-button:active:not(:disabled),
.workspace-toolbar button:active:not(:disabled),
.dialog-actions button:active:not(:disabled),
.process-step-actions button:active:not(:disabled) {
  filter: brightness(0.95);
}
```

Using `filter: brightness()` gives every button variant (default, primary, danger) a consistent "pressed" darkening with one rule, instead of hand-picking a darker shade per variant.

- [ ] **Step 3: Build and verify**

Run: `bun run build`
Expected: exits 0.

In the browser, hover and click (mouse-down, hold) each of: a `.ui-button` (e.g. "返回" on admin page), a workspace toolbar button, a dialog button (open any dialog), a process-step action button (in a lesson's process table), an editable text field, and a markdown preview block. Confirm:
- Hover transitions smoothly (no instant snap) over ~150ms.
- Mouse-down on buttons visibly darkens the button while held.

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "feat: add transitions and active-press feedback to buttons and editable fields"
```

---

### Task 3: New hover states and shared focus-visible ring

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: the button selector group from Task 2 (`.ui-button`, `.workspace-toolbar button`, `.dialog-actions button`, `.process-step-actions button`) and `--green-600`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add hover tint to non-active sidebar items**

In `src/style.css`, locate `.lesson-sidebar-select` (currently no hover rule) and add a new rule immediately after it:

```css
.lesson-sidebar-select {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  text-align: left;
  padding: 10px 12px;
  cursor: pointer;
  min-width: 0;
  transition: background-color 0.15s ease;
}

.lesson-sidebar-item:not(.lesson-sidebar-item--active) .lesson-sidebar-select:hover {
  background: #f4f6f7;
}
```

(The `:not(.lesson-sidebar-item--active)` guard keeps this from fighting with the existing green `--active` background on the selected item.)

- [ ] **Step 2: Add hover tint to table rows**

In `src/style.css`, locate the `.ui-table tr:last-child td` rule and add a new rule right after it:

```css
.ui-table tr:last-child td {
  border-bottom: none;
}

.ui-table tbody tr:hover {
  background: #f8faf9;
}
```

- [ ] **Step 3: Add shared `:focus-visible` ring for buttons**

In `src/style.css`, add this new rule right after the `:active:not(:disabled)` rule added in Task 2 Step 2:

```css
.ui-button:focus-visible,
.workspace-toolbar button:focus-visible,
.dialog-actions button:focus-visible,
.process-step-actions button:focus-visible {
  outline: none;
  border-color: var(--green-600);
  box-shadow: 0 0 0 2px rgba(45, 122, 88, 0.16);
}
```

- [ ] **Step 4: Build and verify**

Run: `bun run build`
Expected: exits 0.

In the browser:
- Open a lesson with multiple chapters in the sidebar. Hover a non-active sidebar row → light gray background appears; hover does NOT appear on the currently active (green) row.
- Hover over admin/book-list table rows → light tint appears per row.
- Tab (keyboard) through buttons (e.g. admin page header buttons) → a green focus ring appears on the focused button. Click a button with the mouse → no ring appears on click (only on keyboard focus), confirming `:focus-visible` rather than `:focus` is in effect.

- [ ] **Step 5: Commit**

```bash
git add src/style.css
git commit -m "feat: add sidebar/table hover tints and focus-visible ring for buttons"
```

---

### Task 4: Mobile workspace toolbar wrap fix

**Files:**
- Modify: `src/style.css` (the existing `@media (max-width: 900px)` block, by adding a new sibling media block — do not nest inside it)

**Interfaces:**
- Consumes: `--space-2`, `--space-4` from Task 1.
- Produces: nothing consumed by later tasks. This is the last task in the plan.

- [ ] **Step 1: Add the new breakpoint**

In `src/style.css`, the existing responsive block currently ends with:

```css
@media (max-width: 900px) {
  .workspace-layout {
    flex-direction: column;
  }

  .lesson-sidebar {
    width: auto;
    flex: 0 0 auto;
    max-height: 180px;
    border-right: none;
    border-bottom: 1px solid var(--line);
  }

  .a4-workspace {
    padding: 6mm;
  }

  .page {
    width: 100%;
    min-height: auto;
  }
}
```

Add a new, separate media block directly after this one (same `/* Responsive */` section, not nested inside the 900px block):

```css
@media (max-width: 600px) {
  .workspace-toolbar {
    height: auto;
    flex: 0 0 auto;
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-4);
    gap: var(--space-2);
  }

  .workspace-toolbar button {
    flex: 0 0 auto;
  }

  .workspace-toolbar-count {
    flex: 1 1 100%;
  }
}
```

- [ ] **Step 2: Build**

Run: `bun run build`
Expected: exits 0.

- [ ] **Step 3: Verify at 390px width**

With the dev server running, open a lesson workspace in the browser and resize/emulate the viewport to 390px wide (e.g. iPhone 12 Pro preset). Confirm:
- The toolbar's 6 buttons wrap onto two rows, each button keeps its full label on one line (no character-by-character wrapping).
- The "已选 N 个" count text drops to its own line below the buttons.
- At desktop width (e.g. 1280px), the toolbar is unchanged from before (single row, fixed 56px height).

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "fix: wrap workspace toolbar buttons on narrow mobile widths"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 (tokens + 3 spacing snaps) → Task 1. Section 2 (transitions, active states, new hovers, focus-visible) → Tasks 2–3. Section 3 (mobile toolbar) → Task 4. Testing section (build + manual desktop/390px check) → covered in every task's verification step.
- **Out-of-scope guardrails carried into Global Constraints:** no `window.confirm()` → `.dialog` migration, no A4/`print.css` changes, no new dependencies, no markup changes — all stated explicitly so a task executor with zero conversation context doesn't drift into them.
- **Type/selector consistency:** the four-selector "button group" (`.ui-button`, `.workspace-toolbar button`, `.dialog-actions button`, `.process-step-actions button`) is used identically across Task 2's transitions/active rule and Task 3's focus-visible rule — verified the selector list matches verbatim in both places.
