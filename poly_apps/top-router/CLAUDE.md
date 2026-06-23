# top-router — Claude Relay Service (AI guidance)

Multi-platform AI API relay (Claude official/Console, Gemini, OpenAI Responses/Codex, Bedrock, Azure, Droid, CCR). Full detail: poly_apps/top-router/README.md / README_EN.md. Global git + code rules: repo-root CLAUDE.md / AGENTS.md.

Project-specific constraints:
- Account selection goes through the unified schedulers (`unifiedClaude/Gemini/OpenAIScheduler`, `droidScheduler`) — never pick accounts directly; respects sticky sessions, load-balancing, failover.
- All sensitive data (OAuth accessToken/refreshToken, credentials) MUST be AES-encrypted in Redis (pattern: `claudeAccountService.js`). API Keys: SHA-256 hashed, `cr_` prefix.
- Each account has its own proxy config (SOCKS5/HTTP); OAuth auth + token exchange must also route through that proxy.
- Format ALL code with Prettier (`npx prettier --write`) before committing.
- Frontend (`web/admin-spa/`): every UI change must support BOTH light and dark mode (Tailwind `dark:` prefix) and be responsive; theme via `stores/theme.js` `useThemeStore()`.
- Tooling: `npm run lint` (ESLint), `npm test` (Jest+SuperTest), `npm run cli status` to verify; logs in `logs/`.
