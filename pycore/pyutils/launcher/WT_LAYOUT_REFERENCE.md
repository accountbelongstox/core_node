# Windows Terminal layout: official docs and ratio

## Source

- **Microsoft Learn**: [Using command line arguments for Windows Terminal](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments)

## Official definitions (quoted)

| Option | Description (from Learn) |
|--------|--------------------------|
| `--pos x,y` | Launches the terminal at the given position. `x` or `y` can be omitted, to use the default value from the settings. |
| `--size c,r` | Launches the terminal with the specified number of **columns (`c`)** and **rows (`r`)**. |

Learn does not state the unit of `--pos` in the table. Other Microsoft and community sources describe `--pos` as **pixel coordinates** (window top-left on screen). `--size` is explicitly **character cells** (columns and rows), not pixels.

## Ratio: screen pixels vs --size

- **Screen / grid**: in **pixels** (e.g. 3840x2160, cell 960x540).
- **--pos x,y**: window top-left position in **pixels**.
- **--size c,r**: **character dimensions** (c = columns, r = rows). The **content area** size in pixels is **not** given by WT; it depends on the profile (font, size, padding). So:
  - content_width_px ≈ c × (pixel width per character)
  - content_height_px ≈ r × (pixel height per character)
  - Full window = content + title bar + frame/padding.

So the **ratio** (pixels per column / per row) is **not** in the WT docs; it is **font- and profile-dependent**. We use the user’s **measurements** in config (`measurements.columns`, `columns_width_px`, `rows`, `rows_height_px`, and calibration) to compute px/column and px/row, then reserve **window_chrome** and apply **content_scale** so that (content + chrome) fits inside one grid cell and windows do not overlap.

## Inter-cell gap (no "squeezed together")

Adjacent grid cells are placed edge-to-edge by default, which can make windows look crowded. The `window_chrome` config also carries two gap values:

- `gap_horizontal_px` (default 16) — gutter between columns.
- `gap_vertical_px` (default 24) — gutter between rows.

In `calculate_window_layout` the gaps are **subtracted from the screen before grid division** and then **re-added as a step between cell origins**:

```
cell_w = (screen_w - (columns - 1) * gap_x) // columns
cell_h = (screen_h - (rows    - 1) * gap_y) // rows
x = screen_x + col * (cell_w + gap_x)
y = screen_y + row * (cell_h + gap_y)
```

So the whole grid still fits the screen, and every pair of neighboring windows sits `gap_*_px` apart on both axes. `--pos`/`--size` semantics are unchanged (pixels / character cells); only the cell sizing and origin step change.

## References

- [Windows Terminal command line arguments](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments) (options table)
- GitHub issue #2984: WT may not respect requested cols/rows exactly; window can open with different dimensions. Hence we use a content_scale &lt; 1 so the requested content stays within the cell.
