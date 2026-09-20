# CodeMart Continuation Functional Record

Date: 2026-09-19 (functional-only)
Main design: `DESIGN_20260823_CODEMART_PYCORE_UI_LARAVEL_MAIN.md`

This record continues the CodeMart progress records. It describes only
user-facing functions and their verified status; it contains no code,
file, or architecture descriptions.

## Functions completed in this continuation

- Project AI analysis in the interface: a client runs the analysis from
  the project card, watches progress update automatically, reads the
  proposal with estimates and recommendations, accepts it (the project
  moves to funding pending), or requests a revision with notes. The
  analysis session survives page reloads. Status: done, verified live.
- Developer task workspace: submit a deliverable with notes for review,
  and post task comments. Status: done, verified live.
- Reviewer experience: start the reviewer qualification, rate three
  sample snippets across quality, readability, and efficiency with
  comments, receive the pass/fail outcome, then work the review queue
  with dimensional ratings and comments; repeat reviews are rejected.
  Status: done, verified live.
- Architect experience: eligibility table, application, deposit-funded
  activation, lists of assigned and open architecture projects, and
  project acceptance. Status: done, verified live.
- Wallet actions: deposit top-up with payment method selection, payment
  link, and deposit history; payments list with invoice creation and
  refund requests. Status: done, verified live.
- Phone verification in the interface: the user requests a one-time code,
  enters the six-digit code, and the onboarding state updates; already
  verified numbers reject further attempts. Status: done, verified live.
- Identity (KYC) submission in the interface: document type, number, legal
  name, birth date, and front/back/selfie images with upload progress;
  duplicate document numbers are rejected, and the pending-review state is
  shown until an administrator decides. Status: done, verified live.
- Project detail page: overview, milestone and task listing, project
  editing for the owner, milestone creation, and task creation per
  milestone. Status: done, verified live.
- Payment and submission state vocabulary surfaced in the interface in
  both English and Chinese. Status: done.
- Demo dataset for local evaluation: four demo accounts (client,
  developer, architect, reviewer) with profiles, wallets, paid deposits,
  five projects across the delivery states, milestones, marketplace
  tasks, and approved testimonials. Seeding is idempotent and runs only
  through the 175 deployment script, which asks whether to initialize the
  CodeMart demo data (default: no). Status: done, verified live.

## Server corrections applied in this continuation

- Project, submission, and payment state constraints aligned with the
  canonical vocabulary through the idempotent system initialization;
  existing data preserved, tables modified in place only. Status: done.
- Reviewer queue and dimensional review recording repaired and aligned
  with the review record structure. Status: done, verified live.

## Verified end-to-end in this continuation

- AI analysis cycle: analyze, complete, accept, revision, regeneration.
- Delivery chain: project, milestone, task, publish, marketplace, atomic
  acceptance, deliverable submission, comment, client approval.
- Reviewer qualification, queue, dimensional review, duplicate guard.
- Architect eligibility, application, deposit activation, acceptance.
- Deposit top-up creation and history.
- Onboarding: phone code request and verification, identity document
  upload with duplicate rejection, onboarding truth refresh.
- Project detail: owner edit, milestone creation, task creation, and
  detail view with nested milestones and tasks.
- Demo dataset: every demo account signs in and exercises its role
  surface (client projects, developer marketplace and wallet, architect
  project acceptance, reviewer queue), and the deployment-script seed is
  idempotent across repeated runs.

## Documentation

- All CodeMart documents are collected in `docs_fix/codemart_docs/` and
  reduced to functional-only descriptions; the legacy Flutter reference
  material keeps only functional behavior. Status: done.
