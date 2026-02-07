# Post-Login Battle.net Elements - Control Reference

Data source: exported via debug button and copied to `docs/登陆后的战网元素.json` (UI Automation, Chromium Battle.net).

## Controls in use (BattlenetOperation)

| Function | automation_id | name / type | Note |
|----------|----------------|-------------|------|
| D3 game tab | `game-nav-btn-D3CN` | TabItemControl "Diablo III" | Click to switch to D3 tab |
| Start game button area | `play-btn-main` / `play-btn` | GroupControl | Click to start game; inner ButtonControl "Playing Now: Diablo III" with is_enabled=false means game is running |

## Logic

- **Game starting / running**: Find control whose name contains "Playing Now" / "Play" / "开始游戏"; if `is_enabled` is False or name contains "Playing Now", treat as in-game.

## To implement (from JSON or OCR)

- Agreement checkbox, confirm login click, whether on login screen, whether already logged in.
