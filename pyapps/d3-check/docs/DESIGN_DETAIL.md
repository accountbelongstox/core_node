# D3-Check Design Document (Detailed)

This document is the detailed design; use together with [DESIGN.md](DESIGN.md): DESIGN.md is the overview and index, this document focuses on Login Try and Battle.net disconnect/restart design.

---

## 1. Overview

D3-Check is a Diablo III / Diablo IV automation control sub-application, providing macro control, log monitoring, ROSBOT extension, Battle.net disconnect detection and restart, etc.

---

## 2. Login Try and Battle.net Disconnect Restart

### 2.1 Trigger

- **Log trigger**: Configured trigger string appears in ROSBOT log file (default `Documents\RoS-BoT\Logs\history.txt`).
- **Config**: `log_detection.login_try`, default `"Login try"`.
- **Constant**: When not configured, uses `config.constants.LOGIN_TRY_TRIGGER_DEFAULT` (`"Login try"`).

### 2.2 Flow (no Python threads)

When a log line contains the trigger, `d3utils.log_analyzer` calls `LoginTryScreenshotController.handle_login_try()`, which runs in order:

1. **Read config**
   - Battle.net executable path: `CONFIG["battlenet"]["battlenet_path"]` (e.g. `...\Battle.net.exe`).
   - If not set or file missing, only fullscreen screenshot (`capture_screenshot()`), no disconnect detection or restart.

2. **Capture Battle.net window**
   - Uses `d3utils.screenshot_provider.get_screenshot_provider().gen(use_optimized_capture=True, window_titles=BATTLE_NET_WINDOW_TITLES)`.
   - Window titles from `providor.providor_index.BATTLE_NET_WINDOW_TITLES` (multi-locale).
   - Screenshots saved to `config.constants.LOGIN_TRY_SCREENSHOT_DIR`, prefix `LOGIN_TRY_SCREENSHOT_PREFIX` (e.g. `login_try_battlenet_*.png`).
   - If Battle.net window not found, falls back to fullscreen screenshot and returns.

3. **OCR to detect disconnect**
   - Uses `providor.common_imports.CnOCREngine` for full-image OCR on the screenshot.
   - Disconnect keywords: `config.constants.BATTLE_NET_DISCONNECT_KEYWORDS`, default `("Retry", "重试")`.
   - If any keyword appears in recognized text, treated as **disconnected**.

4. **Restart Battle.net on disconnect**
   - **Kill process**: `subprocess.run(["taskkill", "/F", "/IM", "Battle.net.exe"], ...)` (Windows taskkill only).
   - **Wait**: ~2 seconds.
   - **Start**: `subprocess.run(["explorer", str(exe_path)], cwd=parent)`; path and cwd from config `battlenet_path`.

### 2.3 Modules and Constants

| Module/File | Role |
|-------------|------|
| `d3utils.log_monitor` | Read log at interval, call `log_analyzer.analyze_log_line(line)` |
| `d3utils.log_analyzer` | Parse each line; if contains Login try trigger, call `get_login_try_screenshot_controller().handle_login_try()` |
