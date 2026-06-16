# Frontend Routing Design

## Goal

Add URL-backed frontend routing so users can refresh or directly open the main app views without losing their place.

## Scope

In scope:

- Add routes for login, book list, book workspace, and admin user management.
- Keep the existing component structure: `LoginPage`, `BookListPage`, `WorkspaceView`, and `AdminPage`.
- Preserve the existing auth behavior and API calls.
- Preserve the existing backend API routes and static SPA fallback.
- Add focused tests for routing behavior.

Out of scope:

- Adding nested lesson-level URLs.
- Adding a new navigation layout.
- Replacing the current auth model.
- Adding a third-party router package unless the existing code makes a local router impractical.

## Approaches Considered

The recommended approach is a small local router built around `window.history` and `popstate`. The project does not currently use `vue-router`, and the app only needs four top-level route states. A local router keeps the change small and avoids a new dependency.

A second option is adding `vue-router`. It would be more conventional for a growing Vue app, but it adds dependency and setup overhead for a narrow routing surface.

A third option is hash routing, such as `/#/books/b1`. It avoids server fallback concerns, but the server already serves `dist/index.html` for unknown paths, so clean history URLs are a better fit.

## Routes

The frontend will support these clean URLs:

- `/login` shows `LoginPage`.
- `/books` shows `BookListPage`.
- `/books/:bookId` shows `WorkspaceView` for the selected book.
- `/admin` shows `AdminPage`.

Unknown paths redirect to the best available default: `/books` when logged in and `/login` when logged out.

## Auth Behavior

`App.vue` still calls `fetchMe()` on mount. While logged out, any route except `/login` resolves to the login page and updates the URL to `/login`.

After login succeeds, the app routes to `/books`. Logout continues to clear tokens through `useAuth`; when the app observes the logged-out state, it routes to `/login`.

The admin page remains visible only through the existing admin entry point in `BookListPage`. If a non-admin user reaches `/admin` directly, the backend admin API will still return authorization errors. The frontend may render the page shell, but protected data will not load.

## Component Behavior

`BookListPage` keeps emitting `open` and `admin`. `App.vue` will translate those events into route changes:

- `open(id)` navigates to `/books/{id}`.
- `admin` navigates to `/admin`.

`WorkspaceView` keeps emitting `back`; `App.vue` maps it to `/books`.

`AdminPage` keeps emitting `back`; `App.vue` maps it to `/books`.

This preserves component contracts and confines route ownership to the app shell.

## Error Handling

Book load errors remain handled by `WorkspaceView`. Its existing "返回列表" action navigates back to `/books`.

Route parsing should be strict enough to avoid invalid view state. Empty or malformed book IDs fall back to `/books`.

## Testing

Add or update `App.test.ts` coverage for:

- Starting at `/books` renders the book list.
- Opening a book updates the URL to `/books/:bookId` and renders the workspace.
- Pressing workspace back updates the URL to `/books`.
- Opening admin updates the URL to `/admin`.
- Logged-out users are routed to `/login`.

Run the focused app tests and the project build after implementation.
