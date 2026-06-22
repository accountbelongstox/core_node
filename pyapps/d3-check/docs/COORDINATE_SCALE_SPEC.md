# Coordinate and Scale — Latest Algorithm

## Rule (everything follows this)

**Screenshot (window size / coordinates) and offset values all use the same flow:**

1. **Subtract border** (convert to content-space).
2. **Do the calculation** (scale by content ratio).
3. **Add border back** (convert to actual outer pixel).

Frame is fixed (8, 8, 31, 8). Only the content area scales. So we always: **subtract frame → compute (scale) → add frame back**.

---

## Frame constants (fixed)

| Constant | Value |
|----------|-------|
| WINDOW_BORDER_LEFT | 8 |
| WINDOW_BORDER_RIGHT | 8 |
| TITLE_BAR_HEIGHT | 31 |
| WINDOW_BORDER_BOTTOM | 8 |

Standard outer size when content is 1300×800: **1316 × 839**.

---

## 1. Screenshot (window size) → effective content and scale

- **Actual window** = screenshot/GetWindowRect size (e.g. 1316×839).
- **Step 1 — Subtract border:**
  - `effective_actual_width  = actual_width  - (WINDOW_BORDER_LEFT + WINDOW_BORDER_RIGHT)`  → e.g. 1316 − 16 = 1300
  - `effective_actual_height = actual_height - (TITLE_BAR_HEIGHT + WINDOW_BORDER_BOTTOM)` → e.g. 839 − 39 = 800
- **Step 2 — Compute scale (content ratio):**
  - `scale_x = effective_actual_width  / 1300`
  - `scale_y = effective_actual_height / 800`
- **Step 3 — Add border back:** not applied to the size itself; scale is used on content-space values. When we later convert a coordinate or offset to actual pixel, we add border back there.

So for **screenshot/window size**: we subtract border to get effective content size, then use that to compute scale. The “add back” is applied when we turn a standard coordinate or offset into an actual pixel (below).

---

## 2. Coordinates (standard → actual pixel)

Standard coordinates are in **standard outer space** (0..1316, 0..839).

- **Step 1 — Subtract border:**  
  `content_x = std_x - WINDOW_BORDER_LEFT`  
  `content_y = std_y - TITLE_BAR_HEIGHT`
- **Step 2 — Compute (scale):**  
  `scaled_content_x = content_x * scale_x`  
  `scaled_content_y = content_y * scale_y`
- **Step 3 — Add border back:**  
  `scaled_x = scaled_content_x + WINDOW_BORDER_LEFT`  
  `scaled_y = scaled_content_y + TITLE_BAR_HEIGHT`

**Formula:**  
`scaled_x = (std_x - 8) * scale_x + 8`  
`scaled_y = (std_y - 31) * scale_y + 31`

---

## 3. Offset values (standard → actual pixel)

Same rule. Offsets are in standard outer space; they must also **subtract border → scale → add border back**.

- **Step 1 — Subtract border:**  
  For x (left/right): `content_val = value - WINDOW_BORDER_LEFT` (or RIGHT when meaning right-edge).  
  For y (top/bottom): `content_val = value - TITLE_BAR_HEIGHT` (or BOTTOM for bottom).
- **Step 2 — Compute (scale):**  
  `scaled_content = content_val * scale_x` (or `scale_y` for vertical).
- **Step 3 — Add border back:**  
  `scaled_value = scaled_content + WINDOW_BORDER_LEFT` (or TITLE_BAR_HEIGHT / RIGHT / BOTTOM as appropriate).

**Formula (single value):**  
`scaled = (value - border) * scale + border`  
Implemented as `scale_standard_value_to_actual(value, scale, border)`.

---

## Summary

| Input | Step 1 (subtract border) | Step 2 (compute) | Step 3 (add border back) |
|-------|---------------------------|------------------|----------------------------|
| Screenshot size | effective_actual = actual_outer − (L+R) or −(T+B) | scale = effective_actual / 1300 or 800 | — (scale used below) |
| Coordinate (x,y) | content = std − (8 or 31) | content * scale_x / scale_y | + 8 or + 31 → actual pixel |
| Offset value | value − border | * scale | + border → actual pixel |

**Screenshot and offset values both: subtract border first, then compute, then add back.** No exception.

---

## Implementation

- **Coordinates:** `calculate_unified_scaled_coordinate()` — windowed path uses `(std - border) * scale + border` for x and y.
- **Offsets:** `scale_standard_value_to_actual(value, scale, border)` — same formula.
- **Bag region:** Stored as (925, 445), (1297, 665) in standard outer space; scaling (and thus subtract/scale/add-back) is done inside the scale method only.

## Fullscreen

No frame; actual and standard are content size only. Scale = actual / standard, and `scaled = std * scale` (no subtract/add).
