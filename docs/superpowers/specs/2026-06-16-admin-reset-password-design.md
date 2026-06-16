# Admin Reset Password Design

## Goal

Add a user-management action that lets an administrator reset any existing user's password to the fixed temporary password `123456`.

## Scope

In scope:

- Add a backend admin route for resetting a user's password.
- Add database helpers to update a user's password hash and clear that user's refresh tokens.
- Add a "重置密码" action in `AdminPage.vue` next to the existing delete action.
- Use the shared app control styles already used by the user management page.
- Add focused backend and frontend tests.

Out of scope:

- Letting admins choose a custom reset password.
- Generating random temporary passwords.
- Forcing the target user to change the password after login.
- Adding email, notification, or audit-log workflows.

## Backend Behavior

Add `POST /api/admin/users/:id/reset-password` under the existing admin router. The route keeps the current authorization model:

- Unauthenticated users receive `401` from bearer auth.
- Non-admin users receive `403` from the admin guard.
- Missing target users receive `404` with `用户不存在`.
- Valid reset requests hash the fixed password `123456`, update the target user's `password_hash`, delete that user's refresh tokens, and return `{ ok: true }`.

Clearing refresh tokens prevents old sessions from getting new access tokens after a reset. Existing short-lived access tokens may remain valid until they expire; this matches the current token model and avoids adding token revocation infrastructure.

## Frontend Behavior

`AdminPage.vue` adds a neutral `重置密码` button for each user row, placed before the existing red `删除` button. The button uses `ui-button`, not the danger variant, because the user account remains active.

Clicking the button asks for confirmation:

`确定要将该用户密码重置为 123456 吗？`

If the admin cancels, no request is sent. If confirmed, the page calls:

`POST /api/admin/users/{id}/reset-password`

On success, show a short success message near the existing error area:

`已将密码重置为 123456。`

On failure, reuse the existing `error` state and display the backend message or `重置失败`.

## Data Flow

The frontend sends no password body because the reset value is fixed by product requirement. The backend owns the fixed password and hashing so clients cannot accidentally drift from the required reset behavior.

The database layer exposes two focused helpers:

- `updateUserPasswordHash(db, id, passwordHash): boolean`
- `deleteRefreshTokensForUser(db, userId): number`

The admin route composes these helpers after hashing `123456`.

## Testing

Database tests verify updating a user's password hash and deleting refresh tokens for that user.

Admin route tests verify:

- Admin can reset an existing user's password.
- The new fixed password validates through `verifyPassword`.
- Resetting a missing user returns `404`.
- Existing non-admin authorization still blocks the route.
- Refresh tokens for the target user are cleared.

Frontend tests verify:

- A reset button renders with the shared neutral button style.
- Confirming reset calls the expected admin endpoint.
- Canceling confirmation does not call the endpoint.
- A successful reset displays the fixed-password success message.
