# CodeMart Flutter Reference: Data Center Usage (Functional Guide)

Functional-only revision: 2026-09-19. Only the functional behavior of the
legacy data center is described here; no code or architecture.

## What it manages

- Authentication state: logged in or not, and the current session.
- User profile: the developer or client profile attached to the account.
- Active user mode: developer mode or client mode.
- Debug mode: whether the app runs against mock data instead of the real
  backend.

## Functional behavior

- Reading state: any page can read the current login state, profile, and
  mode, and always sees the same values.
- Login: in production mode, credentials are checked against the backend;
  in debug mode, a mock account is accepted instantly. A successful login
  updates the session and profile everywhere.
- Logout: clears the session and returns all pages to the logged-out
  state.
- Profile update: saving a profile change makes it visible to every page.
- Mode switch: switching between developer and client mode re-orients the
  whole interface to the selected role.
- Debug mode: when enabled, the app uses built-in mock accounts, mock
  profiles, and simulated delays so all flows can be tried without a
  server. When disabled, the app talks only to the real backend.

## Frequently asked

- Can debug mode call the real API? No; debug mode exists precisely to
  work without the backend.
- Can debug mode be toggled at runtime? It is a development setting and is
  fixed off for production builds.
