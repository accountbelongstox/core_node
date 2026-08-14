# WordNew i18n state ownership refactor

Date: 2026-08-11

Source: `_prompts/队列中心.txt`, including the centralized-library and duplicate-definition requirements.

- Moved i18next initialization from the Laravel Manager application boundary to the shared UI core.
- Kept the former Laravel Manager i18n module as a compatibility export so existing consumers use the same runtime.
- Made the Shell the only language and theme state owner for Laravel Manager, Pycore Manager, and WordNew.
- Moved URL language hydration and live URL language changes to the Shell instead of handling them inside Laravel Manager.
- Normalized URL, storage, and backend language codes against the shared Shell language catalog.
- Removed Laravel Manager's duplicate i18next language update and duplicate DOM theme update.
- WordNew continues to read language and theme from the Shell, so route changes no longer restore a second application-local value.

The reported `content_main.js` dynamic-i18n schema error originates in the injected Immersive Translate content script. Queue Center schema versions and application i18next versions are separate contracts and must not be rewritten to imitate that extension protocol.

Per project instructions, no tests, builds, or services were run.

## Brand icon follow-up

- Found that the generated 64px PNG data URI decoded correctly, while the 128px data URI had an invalid Base64 length.
- Replaced both inline data URIs with Vite-managed imports of the existing generated PNG files.
- Updated the brand generator to keep producing the same stable asset-import module on future runs.
- Queue Center delivery icons remain Lucide SVG components and were not involved in the invalid PNG request.
- Statically checked both source PNG files and visually inspected the 128px asset.
