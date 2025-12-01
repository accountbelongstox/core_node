# Terminal Auto Finder

Small Python utility that automatically discovers installed terminal applications across Windows, macOS, and Linux. The codebase is split into ten layered directories so configuration data stays isolated from the terminal-search logic.

## Directory layout

Configuration layers:

1. `config`
2. `config/base`
3. `config/platforms`
4. `config/rules`
5. `config/outputs`

Terminal search logic layers:

6. `finder`
7. `finder/scanners`
8. `finder/resolvers`
9. `finder/validators`
10. `finder/reporters`

Each folder contains small, focused modules (e.g., platform definitions live under `config/platforms`, scanning logic under `finder/scanners`).

## Usage

```bash
cd /www/programing/core_node
python -m scripts.gan_codex --extra-path ~/bin
```

Options:

- `--extra-path PATH`: add additional directories to scan (can be repeated)
- `--hide-missing`: do not show the "Missing" section
- `--compact`: suppress per-terminal descriptions

The command prints a summary of all detected terminals and exits with `0` when at least one terminal is found.

## Cursor mover helper

The `scripts/gan_codex/cursor_mover.py` utility re-centers the mouse pointer on a fixed coordinate every few seconds. It supports both `pyautogui` (cross-platform) and `xdotool` (Linux) backends.

```bash
cd /www/programing/core_node
python scripts/gan_codex/cursor_mover.py
```

All runtime values are hard-coded at the top of `cursor_mover.py`:

- `TARGET_X`, `TARGET_Y`: absolute coordinates
- `INTERVAL_SECONDS`: seconds between moves
- `MOVE_DURATION_SECONDS`: animation duration (ignored by `xdotool`)
- `BACKEND`: `auto`, `pyautogui`, or `xdotool`

Use `Ctrl+C` in the terminal to stop the script.
