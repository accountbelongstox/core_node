# pycore_laravel_wordflow_ui — docs

React + Vite SPA that is **one shell hosting three ends**: `laravel-manager`, `pycore-manager`, and `wordflow`. Served by laravel_main in production.

- **Run:** `npm install` → `npm run dev`. **Build:** `npm run build` (`vite build`).

## Index

- [ARCHITECTURE.md](ARCHITECTURE.md) — the shell + 3 ends, layers, cross-cutting frameworks, directory map.
- [API.md](API.md) — the `api` singleton, `BaseAPI` conventions, module catalog, endpoint switching.
- [UI.md](UI.md) — overlay/Portal framework, toast/confirm, theme, logging conventions.
- [TTS_QUEUE_MANAGEMENT_BACKEND_CONTRACT.md](TTS_QUEUE_MANAGEMENT_BACKEND_CONTRACT.md) — TTS queue stats FE↔BE contract.

WordFlow keeps its own design docs under `apps/wordflow/docs/`.

> Source of truth is the code: API methods document their URL + shape in JSDoc; these docs cover only the design and conventions that aren't obvious from a single file.
