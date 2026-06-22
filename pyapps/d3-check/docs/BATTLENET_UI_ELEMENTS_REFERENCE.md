# Battle.net UI Elements Reference (UI-only flow, no screenshot/template)

战网流程中「仅操作 UI 元素」时使用的控件定义与参考文档索引。

## 参考文档

| 文档 | 说明 |
|------|------|
| `登陆后的战网元素-控件说明.md` | 登陆后主界面控件说明（D3 Tab、开始游戏） |
| `POST_LOGIN_BATTLENET_CONTROLS.md` | 同上英文版 |
| `登陆后的战网元素.json` / `登陆后的战网元素1.json` | 调试导出的控件树（UI Automation） |
| `BATTLENET_ASIA_LOGIN_UI_AND_EXTENSION_PLAN.md` | 亚服/国服登录界面变体与扩展计划 |

## 无截图流程使用的控件（app_constants + battlenet_region_judge）

- **D3 标签页**：`D3_TAB_AUTOMATION_IDS`（如 `game-nav-btn-D3CN`, `game-nav-btn-D3`）、`D3_TAB_NAME_KEYWORDS`；亚服见 `get_asia_d3_automation_ids()` / `get_asia_d3_name_keywords()`。
- **开始游戏按钮**：`START_GAME_AUTOMATION_IDS`（如 `play-btn-main`, `play-btn`）、`START_GAME_NAME_KEYWORDS`；亚服见 `get_asia_play_automation_ids()` / `get_asia_play_name_keywords()`。
- **状态判断**：`BattlenetOperation.get_dynamic_state()` 返回 `(on_login_screen, disconnected, normal_available, ...)`，全部基于 UI 枚举，无截图/OCR/模板。

国服登录（同意/网易/登录按钮）：见 `BATTLE_NET_CN_*` 系列常量及 `BattlenetOperation.perform_cn_login_flow()` / `click_cn_login_button()`。
