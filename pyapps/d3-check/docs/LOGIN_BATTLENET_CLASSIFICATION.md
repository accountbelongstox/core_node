# Login / Battle.net 功能分类与复用分析

本文档对「登录尝试、战网窗口、D3 小图匹配」相关代码做功能分类，标出**不合理**与**可复用**点，便于后续按模块重构。

---

## 1. 功能分类总览

| 分类 | 职责 | 当前位置 | 依赖 |
|------|------|----------|------|
| **进程/窗口管理** | 战网/D3 进程 kill、start、找窗、置前 | d3utils/battlenet_manager, d3_manager, process_helper | WindowFinder, WindowActivator, config |
| **配置/资源** | 战网 exe 路径、模板路径、模板首次拷贝 | BattleNetManager.get_path；LoginTryScreenshotController._ensure_d3_small_map_template | CONFIG, BATTLENET_TEMPLATE_CONFIGS |
| **OCR** | 对截图做 OCR，判断是否包含某类关键词；国服流程需按关键词取 bbox 并点击 | ocr_helper：ocr_has_any_keywords、ocr_find_keyword_boxes、bbox_center、bbox_first_char_center | CnOCREngine, BATTLE_NET_*_KEYWORDS、BATTLE_NET_CN_*_KEYWORDS |
| **战网窗口截图** | 截战网窗口并保存到目录 + 清理旧图 | _capture_battlenet_window；ensure_battlenet_started_and_login_check 内再次 gen+save | screenshot_provider, LOGIN_TRY_SCREENSHOT_DIR, screenshot_categories |
| **战网模板匹配** | 按配置加载模板、按窗口尺寸缩放、ImageMatcher/cv2 匹配 | _match_battlenet_template, _match_battlenet_template_with_method, _get_best_attempt_for_debug | BATTLENET_TEMPLATE_CONFIGS, ImageMatcher, cv2 |
| **调试图保存** | 在截图上画匹配框/模板小图/文字并保存 | _save_match_debug_image, _save_no_match_debug_image | image_annotator_helper, MATCH_DEBUG_DIR |
| **全方法调试** | 对所有匹配方法跑一遍并保存调试图 | debug_all_match_methods, ALL_MATCH_METHODS | 上述匹配 + 调试图保存 |
| **编排（控制器）** | 串联：截屏 → OCR → 杀/启进程 → 托盘点击 → 匹配 → 点击 | handle_login_try, handle_screenshot_trigger, ensure_battlenet_started_and_login_check | 以上全部 |

---

## 2. 不合理 / 应优化点

### 2.1 战网模板「加载 + 缩放」重复三处

- **位置**：`_match_battlenet_template`、`_match_battlenet_template_with_method`、`_get_best_attempt_for_debug`。
- **问题**：从 BATTLENET_TEMPLATE_CONFIGS 读 path、读窗口尺寸、按 BATTLENET_STANDARD_RESOLUTION 算 scale、resize 模板、去 alpha 等逻辑重复三份，仅最后一步不同（ImageMatcher / cv2.matchTemplate）。
- **建议**：抽出**战网模板加载与缩放**单一函数或小模块（如 `load_scaled_battlenet_template(template_name, window_w, window_h)` 返回 `(target_bgr, template_bgr)` 或仅 `template_bgr`），三处统一调用后再分别做「匹配」或「best attempt」。

### 2.2 战网截图「保存 + 清理」两套路径

- **位置**：`_capture_battlenet_window()` 里「gen → save → clean_older_than("login_try")」；`ensure_battlenet_started_and_login_check()` 里再次「gen → img.save → clean_older_than("login_try")」。
- **问题**：同一类操作（战网窗口截图 + 写入 login_try 目录 + 按分类清理）在两处实现，时间戳命名、目录、清理逻辑易不一致。
- **建议**：统一为「战网窗口截图并保存到指定分类目录」一个入口（例如 `capture_battlenet_and_save_to_category("login_try")` 返回 path 或 (screenshot_data, path)），两处流程都调该入口。

### 2.3 PIL → BGR 与既有 image_utils 重复

- **位置**：`LoginTryScreenshotController._pil_to_bgr`；`d3utils.d3u_common.image_utils` 已有 `convert_pil_to_bgr`、`normalize_image_to_bgr`。
- **问题**：controller 内自维护一套转换，与 d3u_common 重复；且 controller 对 RGBA 做了 `[:,:,:3]` 再转 BGR，image_utils 的 `convert_pil_to_bgr` 未显式处理 RGBA。
- **建议**：在 `image_utils` 中统一「PIL → BGR」（含 RGBA 取前 3 通道再转 BGR）；controller 删除 `_pil_to_bgr`，改为调用 `image_utils.convert_pil_to_bgr` 或 `normalize_image_to_bgr`。

### 2.4 OCR「关键词检测」未抽象

- **位置**：`_ocr_has_disconnect_keywords`、`_ocr_has_need_login_keywords` 仅差「关键词元组」和日志文案。
- **问题**：通用能力「对一张图做 OCR，判断文本是否包含给定关键词集合」绑在 controller 内，其它模块（如其它面板、其它触发逻辑）无法复用。
- **建议**：抽出通用函数，例如 `ocr_has_any_keywords(image_path: Path, keywords: Sequence[str], engine=None) -> bool`，放在 d3utils 或 shared（如 ocr_helper），controller 两处改为传入 BATTLE_NET_DISCONNECT_KEYWORDS / BATTLE_NET_NEED_LOGIN_KEYWORDS。

### 2.5 全方法调试与常量挂在控制器

- **位置**：`ALL_MATCH_METHODS`、`debug_all_match_methods()` 均在 LoginTryScreenshotController 中。
- **问题**：控制器职责过重；「对比所有匹配方法并保存调试图」是独立调试能力，与「登录尝试 / 战网重启」编排无关。
- **建议**：将 `ALL_MATCH_METHODS` 与 `debug_all_match_methods` 迁到独立模块（如 d3utils.battlenet_match_debug 或 d3utils.template_match_debug），控制器仅保留「调用该模块入口」的薄封装（若仍需从 UI 触发）。

### 2.6 调试图保存与 annotator 耦合在控制器

- **位置**：`_save_match_debug_image`、`_save_no_match_debug_image` 使用 image_annotator_helper 的 create_annotator、draw_match_result，但封装在 controller 内。
- **问题**：任何「模板匹配结果可视化」都可能需要「画框 + 画模板小图 + 保存」；若其它模块也要同样调试图，会重复逻辑或依赖 controller。
- **建议**：将「匹配结果/无匹配」的调试图保存抽成通用方法（如放在 image_annotator_helper 或单独 debug_image_saver），参数为 (image, match_or_none, label, output_dir, template_path, color)；controller 只传参调用。

---

## 3. 可复用清单

| 能力 | 当前状态 | 建议复用方式 |
|------|----------|--------------|
| **按 exe 杀进程** | process_helper.kill_process_by_exe | 已复用，BattleNetManager / D3Manager 共用。 |
| **战网路径/杀/启/找窗/置前** | BattleNetManager | 已复用，controller 仅调用 get_battlenet_manager()。 |
| **D3 是否运行 / 杀 D3** | D3Manager | 已复用，controller 仅调用 get_d3_manager().kill_if_running()。 |
| **OCR + 关键词** | controller 内两方法 | 抽出 `ocr_has_any_keywords(path, keywords, engine)` 到 d3utils 或 ocr_helper，供多处使用。 |
| **PIL → BGR** | controller._pil_to_bgr；image_utils 已有 convert_pil_to_bgr | 统一到 image_utils，并支持 RGBA；controller 改为调用 image_utils。 |
| **战网模板加载+缩放** | 三处重复 | 单函数/模块 `load_scaled_battlenet_template(name, w, h)`，供匹配与 best_attempt 共用。 |
| **战网窗口截图并保存到分类** | _capture_battlenet_window + ensure 内一段 | 统一为「capture_battlenet_and_save_to_category(category)」或由 screenshot_categories + provider 封装。 |
| **匹配结果/无匹配调试图保存** | _save_match_debug_image, _save_no_match_debug_image | 迁到 annotator_helper 或 debug 模块，接口 (image, match, label, output_dir, template_path, color)。 |
| **全方法匹配调试** | debug_all_match_methods + ALL_MATCH_METHODS | 迁到 d3utils.battlenet_match_debug（或 matcher_debug），controller 只调该模块入口。 |

---

## 4. 模块归属（已实施）

| 模块/类 | 路径 | 职责 |
|---------|------|------|
| **process_helper** | `d3utils/process_helper.py` | `get_pid_from_hwnd(hwnd)`、`kill_process_by_pid(pid)`、`kill_process_by_exe(exe_name)`。D3 按窗口 PID k，战网仍按 exe 名 k。 |
| **battlenet_manager** | `d3utils/battlenet_manager.py` | 战网路径、kill、start、find_windows、activate_window。每次对战网点击前需先 activate_window。 |
| **d3_manager** | `d3utils/d3_manager.py` | `_find_windows()`（WindowFinder + use_cache=True）、`is_running()`、`kill_if_running()`：按**找到的窗口取 PID** 再 k，不依赖固定 exe 名。 |
| **d3u_common.image_utils** | `d3utils/d3u_common/image_utils.py` | `convert_pil_to_bgr(pil_image)`（含 RGBA 取前 3 通道转 BGR），供 matcher 使用。 |
| **ocr_helper** | `d3utils/ocr_helper.py` | `ocr_has_any_keywords(image_path, keywords, ...)`；`ocr_find_keyword_boxes(image_path, keywords, ...)` 返回 `[{keyword, text, bbox}]`（图像坐标），用于国服流程点击；`bbox_center(bbox)`、`bbox_first_char_center(bbox, num_chars=3)`。国服流程：OCR 找「您同意」点首字、「使用网易账号登录或注册」点中心、等 5s、全屏截图 OCR 点「登陆」。 |
| **battlenet_template_matcher** | `d3utils/battlenet_template_matcher.py` | `load_scaled_battlenet_template(name, w, h)`、`match_battlenet_template(...)`、`get_best_attempt_tm(...)`；统一缩放与匹配。 |
| **battlenet_capture** | `d3utils/battlenet_capture.py` | `capture_battlenet_and_save_to_category(category)`，返回 `(screenshot_data, path)`，含清理。 |
| **battlenet_match_debug** | `d3utils/battlenet_match_debug.py` | `ALL_MATCH_METHODS`、`debug_all_match_methods(...)`；controller 仅薄封装调用。 |
| **image_annotator_helper** | `d3utils/d3u_common/image_annotator_helper.py` | `save_match_debug_image(image_source, match, label, output_dir, ...)`、`save_no_match_debug_image(image_source, method_name, output_dir, ...)`。 |
| **config.screenshot_categories** | `config/screenshot_categories.py` | 截图分类目录与 clean_older_than；战网截图统一走 capture_battlenet_and_save_to_category。 |
| **LoginTryScreenshotController** | `controller/login_try_screenshot_controller.py` | 编排：ensure_battlenet_started_and_login_check 最多 3 轮循环，每轮从第一步重来；**重启后等 5 秒**再 continue。need-login 或 无 D3 小图且非国服 → restart(bn_path)；无 D3 小图且国服（OCR 您同意/使用网易账号登录或注册）→ _run_cn_login_flow（点您同意首字→点网易登录→等 5s→全屏 OCR 点登陆）→ continue。D3 小图匹配成功则点小图、点 Play、sleep(5)、轮询 D3、resize、D3 开始游戏/游戏工具等待、k ROSBOT、start、start_rosbot_task()。 |

---

## 5. 实施结果（已完成）

- 战网模板「加载+缩放」：统一到 `battlenet_template_matcher`，三处共用。  
- PIL→BGR：统一到 `image_utils.convert_pil_to_bgr`，支持 RGBA。  
- OCR 关键词：`ocr_helper.ocr_has_any_keywords`。  
- 战网窗口截图并保存：`battlenet_capture.capture_battlenet_and_save_to_category`。  
- 调试图保存：`image_annotator_helper.save_match_debug_image` / `save_no_match_debug_image`。  
- 全方法调试：`battlenet_match_debug.debug_all_match_methods`，controller 薄封装。  
- D3 杀进程：按找到的窗口取 PID 再 k（process_helper.kill_process_by_pid），数据与 WindowFinder 一致。  
- 战网每次点击前：`get_battlenet_manager().activate_window()` + sleep(0.3)。  
- D3 窗口就绪后启动 ROSBOT：轮询 D3 窗口 → k ROSBOT 若在跑 → start 主 exe → start_rosbot_task()；见 DESIGN.md 3.8、ROSBOT_FLOW.md。
