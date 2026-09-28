# CodeMart Flutter Reference: Unified Data Center (Functional Summary)

Functional-only revision: 2026-09-19. This document keeps only the
functional description of the legacy Flutter CodeMart reference app. It
contains no code or architecture descriptions; the current implementation
is the authority for those.

## Purpose

The legacy app provided a single, unified data center that held all
user-facing state for the CodeMart mobile experience, so every page read
and wrote the same session and profile information.

## Functional features

- Unified session state: one place tracks whether the user is logged in,
  who the user is, and which profile (developer or client) is active.
- User mode switching: the user can switch between developer mode and
  client mode; the whole interface follows the active mode.
- Profile management: the user's developer or client profile can be viewed
  and updated, and every page sees the update immediately.
- Login and logout: login validates credentials and establishes the
  session; logout clears it and returns the app to the logged-out state.
- Debug mode: an optional mode that lets testers use the full app without
  a backend, using built-in mock accounts, mock profiles, and simulated
  network delays. The login screen in debug mode offers quick-login
  entries for the mock accounts. Debug mode is strictly a development aid
  and is disabled for production builds.
- Change notification: pages are notified whenever session, profile, or
  mode changes, so the interface always reflects current data.

## Intended use

- Production: debug mode off, all data comes from the real backend.
- Development and testing: debug mode on, all flows can be exercised
  offline with mock data.
