---
name: terminal-workbench-ui
description: Terminal workbench (PcTerminalPage) layout/dispatch facts: tile grid module, idle-agent dispatch module, agent-kind inference limits, scoped tsc recipe on Linux
metadata:
  type: project
---

- Tiles overview (PC) uses `components/terminal/terminalGridLayout.ts` (spatial bands -> grid rows, base 2-4 cols, crowded band gets up to +2 cols); mobile path (`renderGridWindowCard`) untouched. Old `calculateDesktopBounds/CanvasLayout` kept unreferenced on purpose.
- Composer "send to idle agent" lives in `components/terminal/terminalAgentDispatch.ts` (+ `PcTerminalDispatchToggle`); pycore detector only reports a rule (framed_input/boxed_input/prompt_footer/title_glyph), not an agent kind, so kind is inferred in the UI from title + rule (default claude). A backend `agent_kind` field would make it exact (pycore-lead).
- Idle = `ai_agent` set, `agent_activity` present and `!busy`, no prompt_waiting/resume_pending watch entry.
- Another agent edits `PcTerminalInputBox.tsx` (clipboard pull button) concurrently: re-read before editing, expect duplicate `useIsMobile` style clashes.
- Linux: full `tsc --noEmit` stops at syntax errors in node_modules `.d.cts` (no semantic check). Use a temporary scoped tsconfig (types:["node"], include the files, ambient shim for `*?raw`, ImportMeta.env); runs in ~3 s. Delete it afterwards.

**Why:** next terminal-UI task should not rediscover these.
**How to apply:** extend these modules instead of adding parallel logic.
