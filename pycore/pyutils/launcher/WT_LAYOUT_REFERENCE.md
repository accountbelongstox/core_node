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

## References

- [Windows Terminal command line arguments](https://learn.microsoft.com/en-us/windows/terminal/command-line-arguments) (options table)
- GitHub issue #2984: WT may not respect requested cols/rows exactly; window can open with different dimensions. Hence we use a content_scale &lt; 1 so the requested content stays within the cell.
