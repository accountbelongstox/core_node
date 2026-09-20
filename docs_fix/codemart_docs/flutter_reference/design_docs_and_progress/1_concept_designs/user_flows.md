# CodeMart User Flows (Flutter Reference)

Functional-only revision: 2026-09-19. The main user journeys, expressed
without code or architecture.

## Startup flow

App starts → check login state → logged in: enter the home workspace /
not logged in: show the public surface with login and registration.

## Login flow

Enter credentials → validate → success: establish the session and enter
the workspace / failure: show an error and stay on the login screen.

## Registration flow

Choose a role (client or developer) → provide account details and,
optionally, the installation super code → submit → success: the session
starts immediately; a super-code registration becomes an administrator.

## Client delivery flow

Complete verification → fund the deposit → create a project → review the
AI proposal → accept (project waits for funding) or request revision →
fund the project → tasks open in the marketplace → review delivered work
→ approve (funds released) or request revision.

## Developer flow

Complete verification and profile → fund the required deposit → browse
the marketplace → claim an open task (only one developer can claim it) →
deliver work as a submission → receive the review decision → approved
work pays out; revision requests reopen the work.

## Review flow

Reviewer opens the review queue → examines a submission → approves,
rejects, or requests revision → the decision notifies both sides.

## Administration flow

Administrator signs in → opens the separate admin console → reviews
platform totals, manages user role states, decides identity submissions,
confirms deposits (activating roles), and monitors refunds and projects.

## Changelog

- 2025-11-19: Initial user flow design.
- 2026-09-19: Rewritten functional-only.
