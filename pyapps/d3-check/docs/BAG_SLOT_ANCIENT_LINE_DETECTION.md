# Bag Slot Ancient / Primal Ancient Line Detection Algorithm

This document describes the algorithm used to detect whether an equipment slot has an **Ancient line** (远古线) or **Primal Ancient line** (太古线) by scanning the region to the left of the slot in the game window image.

## Purpose

- **Ancient line (远古线)**: Indicated by color `#8D0B08` (dark red). When found, we report "found ancient line".
- **Primal Ancient line (太古线)**: Indicated by color `#B77201` (orange). When found, we report the vertical extent (line height) of that colored segment.

Both are drawn to the left of the item icon in the bag UI. The algorithm determines whether such a line exists and its type (or height for orange).

## Coordinate System

- All coordinates are in **game window image** space (same as bag layout: `top_left`, slot dimensions).
- Slot `(r, c)` has:
  - **Left outer edge**: `x = top_left.x + c * slot_width` (left boundary of the slot).
  - **Vertical center**: `y = top_left.y + (r + 0.5) * slot_height`.

## Algorithm

### Step 1: Define the horizontal search segment

- **Start**: The **left outer edge** of the current equipment slot.
  - `x_start = left_edge_x = top_left.x + c * slot_width`
- **Search length**: **50% of the slot width** (to the left).
  - `search_length = 0.5 * slot_width`
- **End**: `x_end = left_edge_x - search_length`

So we search on the **single horizontal line** at the slot’s vertical center, from `x_start` leftward to `x_end`. The “length” of this search is 50% of the slot width.

### Step 2: Search leftward for a matching pixel

- On the row `y = center_y` (slot vertical center), scan from `x = x_start` to `x = x_end` (decreasing `x`).
- For each pixel, check if its RGB matches either:
  - **Orange** `#B77201` (Primal Ancient), or
  - **Dark red** `#8D0B08` (Ancient),
  with **±5% brightness tolerance per channel** (same reference, scaled by 0.95 and 1.05).
- **First matching pixel** (closest to the slot) is chosen; its color decides the line type (orange vs ancient).

If no pixel in this horizontal segment matches either color, the algorithm reports **no line** and stops.

### Step 3: Extend vertically from the found pixel

- Let `(x_found, y_center)` be the position of the first matching pixel.
- Using the **same color and ±5% tolerance** as that pixel:
  - **Upward**: From `y = y_center - 1` down to `y = 0`, extend while the pixel at `(x_found, y)` still matches; set `y_top` to the topmost matching row.
  - **Downward**: From `y = y_center + 1` to the bottom of the image, extend while the pixel at `(x_found, y)` still matches; set `y_bottom` to the bottommost matching row.
- **Line height** = `y_bottom - y_top + 1` (for orange line we report this value).

### Step 4: Result

- **Orange (#B77201)** found → report **line height** (e.g. `"line height N"`).
- **Dark red (#8D0B08)** found → report **"found ancient line"**.
- **No** matching pixel in the horizontal segment → report **"no line"**.

## Summary

| Step | Action |
|------|--------|
| 1 | Start at the **left outer edge** of the equipment slot. |
| 2 | Search **leftward** along the slot’s center row for a **length of 50% of the slot width**. |
| 3 | If a pixel matches orange or dark red (with ±5% brightness): from that pixel, **extend upward and downward** with the same color rule to get the full line and its height. |
| 4 | Report orange line height, “found ancient line”, or “no line”. |

This is the algorithm used to detect **太古线 (Primal Ancient line)** and **远古线 (Ancient line)** for each equipment slot in the bag.
