# Remove Cover Page Design

## Goal

Remove the cover page feature completely from the teaching book workflow, including UI entry points, editable cover state, and legacy saved `cover` data in book JSON.

## Scope

In scope:

- Remove `TeachingBook.cover` from the domain model.
- Change `TeachingBook.selectedId` from `'cover' | DesignId` to `DesignId | null`.
- Make newly created books start with no selected page.
- Migrate existing stored book JSON by deleting `cover`.
- Migrate existing `selectedId: 'cover'` to the first lesson id, or `null` when the book has no lessons.
- Remove the sidebar "封面" navigation item.
- Remove cover rendering and cover update events from the A4 workspace.
- Stop passing cover state through `WorkspaceView.vue`.
- Delete the unused `CoverPage.vue` component and cover-specific CSS.
- Update tests for the domain model, store behavior, sidebar, workspace, DB migration, and route persistence.

Out of scope:

- Removing book names from the book list. `BookRecord.name` remains the management/display name for each saved book.
- Changing lesson rendering, print layout, Markdown export, ZIP export, or generated lesson content.
- Creating a user-facing migration screen.

## Data Model

`TeachingBook` becomes lesson-only:

```ts
export interface TeachingBook {
  schemaVersion: typeof BOOK_SCHEMA_VERSION
  designs: TeachingDesign[]
  selectedId: DesignId | null
  updatedAt: string
}
```

`createEmptyBook()` returns an empty `designs` array and `selectedId: null`.

The schema version can stay at `1` because the server migration normalizes stored JSON at load/open time. The app does not need to preserve old cover data.

## Legacy Data Migration

The server will normalize every stored book when opening the SQLite database:

- Parse `books.data`.
- Delete `data.cover` when present.
- If `data.selectedId === 'cover'`, set it to `data.designs[0].id` when a first lesson exists, otherwise `null`.
- If `data.selectedId` points to a missing lesson id, set it to the first lesson id or `null`.
- Persist the normalized JSON back into the row only when it changed.

This ensures old database rows no longer contain `cover` after the app starts, not just after a user edits the book.

## UI Behavior

The workspace has no cover page:

- `LessonSidebar.vue` lists lessons only.
- Empty books continue to show the upload dropzone instead of an A4 page.
- `A4Workspace.vue` renders `TeachingDesignPage` only when there is a selected lesson.
- `WorkspaceView.vue` no longer passes cover props or listens for cover update events.

Selection behavior becomes:

- Importing lessons into an empty book selects the first imported/sorted lesson.
- Generating a lesson selects the generated lesson.
- Deleting the selected lesson selects the next lesson, then previous lesson, then `null`.
- Clearing all lessons sets `selectedId` to `null`.

## Removed Code

Delete:

- `src/components/CoverPage.vue`
- Cover-specific CSS rules in `src/style.css`

Keep:

- Book list names and backend book metadata.
- Existing print/export behavior, which already renders lessons without a cover page.

## Testing

Domain tests verify:

- New books do not have `cover`.
- New books start with `selectedId: null`.
- Independent book creation still produces independent lesson arrays.

DB tests verify:

- Opening a database migrates old `cover` data out of saved book JSON.
- Old `selectedId: 'cover'` becomes the first lesson id when lessons exist.
- Old `selectedId: 'cover'` becomes `null` when no lessons exist.
- Invalid selected ids are normalized.

Store/component tests verify:

- `useTeachingBook` no longer exposes `updateCover`.
- Clear/delete/import/generate selection behavior uses `null` or lesson ids only.
- `LessonSidebar` does not render a cover button.
- `A4Workspace` does not import or render `CoverPage`.
- `WorkspaceView` does not pass cover props.

Verification will run the frontend tests, backend tests, and production build.
