# CodeMart Business Data Concepts (Flutter Reference)

Functional-only revision: 2026-09-19. Business data concepts and their
relationships, expressed without code or schema detail.

## Core concepts

- Account: the shared identity used to log in. One account may hold
  several CodeMart roles.
- Role: a capacity of an account — client, developer, reviewer, architect,
  or administrator — each with its own activation state.
- Profile: the professional details of an account for a given role
  (developer profile, client profile).
- Verification: contact (email, phone) and identity (KYC) checks attached
  to the account, with reviewer decisions.
- Project: a client-owned body of work, moving through states from draft
  to completion or cancellation.
- Milestone and task: units of work within a project; tasks can be
  published to the marketplace.
- Submission: developer-delivered work for a task, subject to review.
- Wallet, deposit, escrow, transaction: the money side — balances,
  refundable deposits that unlock roles, protected project funds, and an
  immutable transaction history.
- Notification: domain events delivered to the account with read state.

## Relationships (functional)

- An account holds roles; roles unlock capabilities.
- A client owns projects; projects contain milestones and tasks.
- A developer claims tasks and produces submissions; reviewers decide on
  submissions.
- Deposits activate roles; project funds are held protected until work is
  accepted.

## Changelog

- 2025-11-19: Initial data model design.
- 2026-09-19: Rewritten functional-only.
