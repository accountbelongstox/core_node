# Template Matcher: Unified vs Non-Unified

## Unified matcher (ScaledTemplateMatcherBase)

- **Base**: `share/scaled_template_matcher_base.py` — `ScaledTemplateMatcherBase`, `format_match_schematic()`
- **D3**: `d3utils/d3_scaled_template_matcher.py` — `D3ScaledTemplateMatcher`, `get_d3_scaled_template_matcher()`
- **D4**: `d4utils/d4_scaled_template_matcher.py` — `D4ScaledTemplateMatcher`, `get_d4_scaled_template_matcher()`

**Callers (use unified matcher):**

| Module | Usage |
|--------|--------|
| `controller/game_assistant_controller.py` | `get_d3_scaled_template_matcher().match_template()` |
| `d3utils/collectors/bag_info_collector.py` | `self.scaled_matcher.match_template()` |
| `controller/ctl_func/blacksmith_handler.py` | `self.scaled_matcher.match_template()` |
| `d3utils/game_window_detector.py` | `self.template_matcher.match_template()` |
| `d3utils/collectors/ui_region_collector_anchor.py` | `self._template_matcher.match_template()` |
| `d3utils/d3_start_game_and_teleport_waiter.py` | matcher `match_template` / `match_template_auto_scale` |
| `d4utils/d4_small_map_detector.py` | `match_template_in_region()` |
| `scripts/test_left30_match.py` | `matcher.match_template()` |

When using the unified matcher, each successful match logs a **text schematic** (box = target image, `*` = match position) via `format_match_schematic()` for debugging.

**图中图 (image-in-image)** when matching on a crop: if the target image is a region cropped from the full game, call `format_match_schematic(target_w, target_h, (cx, cy), template_name, region_in_parent=(parent_w, parent_h, region_left, region_top, region_width, region_height))` so the log shows outer box = full game, inner box = crop region, `*` = match position in full coordinates.

## Code not using the unified matcher

These use raw `cv2.matchTemplate` or their own matching; they do **not** get the unified schematic log:

| Module | Notes |
|--------|--------|
| `d3utils/battlenet_template_matcher.py` | Uses `cv2.matchTemplate` directly (Battle.net UI). |
| `scripts/template_matcher_test.py` | Test script using `cv2.matchTemplate` with TM_CCOEFF_NORMED etc. |
| `utils/_obsolete_multi_scale_image_matcher.py` | Obsolete; uses `cv2.matchTemplate`. |

To debug with the same text schematic, either call `format_match_schematic(target_w, target_h, (cx, cy), template_name)` after a match, or refactor to use the unified matcher.
