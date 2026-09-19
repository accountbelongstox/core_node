# CodeMart Functional Overview (Flutter Reference)

Functional-only revision: 2026-09-19. What the application does, expressed
without any code or architecture.

## Audiences

- Visitors: browse the public home, learn about the platform, read the
  delivery process and services, estimate a project, and review privacy
  and terms.
- Clients: register, verify contact details, fund a deposit, create and
  publish projects, review AI proposals, fund milestones, and accept or
  request revisions on deliveries.
- Developers: register, complete verification and profile, fund the
  required deposit, claim open tasks in the marketplace, and submit work
  for review.
- Reviewers and architects: process review queues and provide oversight
  for eligible projects.
- Administrators: use a separate console to manage users, identity
  reviews, deposits, refunds, and cross-user project visibility.

## Functional layers (user-visible)

- Public surface: informational pages and the interactive estimate.
- Account layer: registration (including the installation super code for
  administrators), login, verification, and profile.
- Workspace layer: dashboard, projects, tasks, marketplace, reviews,
  wallet, notifications, and settings, gated by server-granted
  capabilities.
- Administration layer: a separate console with platform oversight
  functions.

## Changelog

- 2025-11-19: Initial concept design.
- 2026-09-19: Rewritten functional-only.
