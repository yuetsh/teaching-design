# UI Detail Polish Design

## Goal

Polish UI details across the whole app: interaction feedback, spacing/radius consistency, and a real mobile layout bug in the workspace toolbar. Found via live screenshots of the running app (login, book list, admin, workspace, dialogs) at desktop and 390px mobile width.

## Scope

In scope:

- `src/style.css`: design tokens for border-radius and spacing, transitions, hover/active/focus-visible states, table/sidebar hover tints, mobile toolbar fix.
- Any component `<style scoped>` blocks that hardcode a radius/spacing value covered by the new tokens (e.g. `AdminPage.vue`, `LoginPage.vue`, dialog components).

Out of scope:

- Replacing native `window.confirm()` (used for delete in `BookListPage.vue` and `AdminPage.vue`) with the app's custom `.dialog` component. This is a behavior/component-level change, not a styling detail — flagged for a future, separate spec.
- Redesigning the A4 teaching-design canvas or `src/print.css`.
- Adding icons, animation libraries, or new dependencies.
- Changing any component's markup structure or behavior, except where strictly required to apply a hover/focus class.

## 1. Radius and Spacing Tokens

Add to `:root` in `src/style.css`:

```css
--radius-sm: 4px;   /* inline controls: editable-text, markdown-preview/source, board-design, process-step-actions button */
--radius-md: 6px;   /* default control radius: ui-button, ui-field, ui-select, workspace-toolbar button, dialog-actions button */
--radius-lg: 8px;   /* cards/surfaces: dialog, login-form */
--radius-xl: 12px;  /* upload-dropzone */
--radius-pill: 999px; /* lesson-sidebar-badge */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
```

Replace existing hardcoded radius values with the matching variable everywhere they appear in `src/style.css` and in component `<style scoped>` blocks (`AdminPage.vue`, `LoginPage.vue`, dialog components). This is a like-for-like swap — current values already map cleanly onto this scale, so visual output should not change except for the spacing snap below.

Snap off-grid spacing values onto the 4px scale where they don't change layout meaningfully:

- `.field` gap `6px` → `var(--space-2)` (8px)
- `.ui-table th/td` padding `8px 10px` → `var(--space-2) var(--space-2)` (8px 8px)
- `.objective-row` gap `6px` → `var(--space-2)` (8px)

Skip snapping any value where it would visibly break an intentional layout (e.g. `process-step-actions { width: 6em }` is a width, not a spacing token, and stays as-is).

## 2. Interaction Feedback (subtle intensity)

Apply `transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease;` to:

- `.ui-button` (covers `--primary` and `--danger` variants)
- `.workspace-toolbar button`
- `.dialog-actions button`
- `.process-step-actions button`
- `.editable-text`, `.markdown-preview` (already have hover background, currently instant)

Add `:active:not(:disabled)` states (one shade darker / more saturated than hover) to the same button selectors above, so clicks feel acknowledged.

Add hover feedback where there is currently none:

- `.lesson-sidebar-select:not(.lesson-sidebar-item--active *)`: light neutral hover background (e.g. `#f4f6f7`), distinct from the existing green `--active` state, transition included.
- `.ui-table tbody tr:hover`: light tint (e.g. `var(--green-100)` at reduced opacity or `#f8faf9`) for scanability.

Add a shared `:focus-visible` style for buttons, matching the existing `.ui-field:focus` treatment (`border-color: var(--green-600); box-shadow: 0 0 0 2px rgba(45, 122, 88, 0.16);`) so keyboard focus is visually consistent between buttons and inputs. Mouse clicks should not trigger this (hence `:focus-visible`, not `:focus`).

## 3. Mobile Workspace Toolbar Fix

Current bug: `.workspace-toolbar` is a fixed-height (56px) single-row flex container with no wrapping. At ~390px width its 6 buttons compress until button text wraps character-by-character, making the toolbar unreadable and unusable.

Fix (selected option B — wrap): add a breakpoint at `max-width: 600px`:

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

Verified by live injection at 390px: all 6 buttons stay on readable single-line labels across two rows, count text drops to its own line below.

## Testing

- Run existing component tests (no behavior or markup changes expected to break them).
- Run `bun run build` (includes `vue-tsc -b`) to confirm no type errors from any `<style scoped>` edits.
- Manually verify in the browser at desktop width and at 390px width (workspace toolbar, sidebar hover, table hover, button focus-visible ring).
