# Unified App Controls Style Design

## Goal

Unify the app-shell control styling so login, book list, and user management pages look like one product. The change targets buttons, form fields, tables, page headers, and alert states that currently use local gray or dark-blue styles.

## Scope

In scope:

- Add a compact shared UI style layer in `src/style.css`.
- Update `LoginPage.vue`, `BookListPage.vue`, and `AdminPage.vue` to use shared classes.
- Use the existing green, white, gray, border, muted, and danger colors already present in the app.
- Keep delete actions visually distinct with a danger style.
- Preserve existing behavior, events, tests, and the current `src/App.vue` login-success change.

Out of scope:

- Redesigning the A4 teaching-design canvas.
- Changing `src/print.css` or print output.
- Reworking layout architecture or adding a component library.
- Adding icons or new dependencies.

## Visual System

The shared control layer will use the existing tokens:

- `--green-700` for primary text and brand emphasis.
- `--green-600` for primary borders, hover borders, and primary button backgrounds.
- `--green-100` for soft hover and selected backgrounds.
- `--line` for neutral borders.
- `--muted` for secondary text.

New shared classes will cover:

- `.app-page` for constrained app-shell pages.
- `.app-page-header` and `.app-page-actions` for page titles and top actions.
- `.ui-button`, `.ui-button--primary`, and `.ui-button--danger` for commands.
- `.ui-field` and `.ui-select` for inputs and selects.
- `.ui-table` for management tables.
- Small supporting text/error classes where needed.

## Component Changes

`LoginPage.vue` will keep the centered sign-in flow, but its local colors, inputs, and submit button will move to the shared visual language. The submit button becomes the primary green style.

`BookListPage.vue` will use the shared page header and button classes. New-book creation uses a shared input and primary button. Open, rename, cancel, save, and admin/logout actions use neutral shared buttons. Delete uses the danger button.

`AdminPage.vue` will use the shared page header, form fields, select, buttons, and table styles. The create action uses the primary button. Delete uses the danger button. The page drops its one-off local button, input, table, and gray hover rules.

## Error Handling

Existing error strings and `app-notice` behavior stay unchanged. The design only normalizes visual presentation. Disabled buttons and fields should remain obviously inactive through opacity, muted colors, and not-allowed cursors.

## Testing

Run the relevant component tests for the touched Vue pages if available, then run the project build. Existing assertions should continue to pass because behavior and accessible labels remain unchanged.
