# Keys Total / keys per hour 算法说明

## 与代码的对应关系

代码实现与下述公式一致。当前界面显示 **883** 和 **-13.21/h** 的原因见文末「为何是 883 而不是 1023」。

---

## 1. 输入与中间量

- **app_start**：`--start` 参数或日志首行时间，例如 `2026-02-09 00:33:39`。
- **current_run_ts**：满足「timestamp ≤ app_start」的**最后一个** Session 的时间戳（如 `2026-02-09 00:32:59`）。
- **data_lines**：从「current_run_ts 对应 Session 所在行」到文件末尾的所有行（当前这次运行可见的区间）。

---

## 2. baseline_rifkeys（基线）

**定义**：在 **timestamp < current_run_ts** 的所有 Session 块里，每个块取**该 Session 的 Rift keys**（仅 Session 级汇总，不含子 Rift），再**求和**。若整份日志的**第一个块**是 Rift（不是 Session），则在此基础上 **+137**（与 RoS-BoT 显示一致）。

- Parser 路径：`baseline_rifkeys_sum(sessions, current_run_ts)` 得到 Session 之和；若 `(head_roots 或 roots)[0].kind == "Rift"` 则 `baseline += 137`。
- 非 Parser 路径：`get_baseline_rifkeys_from_lines(lines, current_run_ts)`，未做 +137（仅 Parser 路径做）。

**不包含**：current_run_ts 对应的那个 Session（即「当前这次运行」的 Session 本身不算进 baseline）。

---

## 3. delta（当前 Session 的 Rift keys 变化）

**定义**：**data_lines** 中**最后一次**出现的 `Rift keys Earned: N` 的 **N**。

- 代码：`_last_rifkeys_in_data_lines(data_lines)`，用正则匹配整行，取最后一个匹配的数值。
- 然后：`earned["Rift keys"] = last_rifkeys`，在 `format_display` 里用 `get_earned(earned, "Rift keys", 0)` 得到的就是这个 delta。

---

## 4. Keys Total（显示的总钥匙数）

公式（与代码一致）：

```text
若 baseline_rifkeys 已给出：
  若 last_rifkeys_val > 0：  Keys Total = last_rifkeys_val
  否则：                     Keys Total = baseline_rifkeys + last_rifkeys_val

即通常情况（delta ≤ 0）：
  Keys Total = baseline_rifkeys + delta
```

对应实现：`watch_rosbot_history.py` 中 `format_display()` 的：

```python
if baseline_rifkeys is not None:
    if last_rifkeys_val > 0:
        keys_total = last_rifkeys_val
        keys_per_h = (keys_total - baseline_rifkeys) * 3600.0 / secs
    else:
        keys_total = baseline_rifkeys + last_rifkeys_val
        keys_per_h = last_rifkeys_val * 3600.0 / secs
```

---

## 5. keys/h（每小时钥匙变化率）

公式（与代码一致）：

```text
keys_per_h = (Keys Total - baseline_rifkeys) * 3600 / boting_secs
           = delta * 3600 / boting_secs
```

其中 **boting_secs** = 从 app_start 到**当前时间**的秒数（`max(0, now - app_start)`）。

对应实现：上面分支里 `keys_per_h = last_rifkeys_val * 3600.0 / secs`（当 delta ≤ 0 时），且 `secs = max(1, boting_secs)`。

---

## 6. 数据流小结

| 步骤 | 含义 | 代码位置 |
|------|------|----------|
| 1 | 取 current_run_ts（最后一个 ts ≤ app_start 的 Session） | `read_and_parse_with_parser` 中按 session_starts 逆序找 |
| 2 | 算 baseline = 所有 ts < current_run_ts 的 Session 的 Rift keys 之和 | `baseline_rifkeys_sum(sessions, current_run_ts)` 或 `get_baseline_rifkeys_from_lines(lines, current_run_ts)` |
| 3 | delta = data_lines 中最后一次 `Rift keys Earned: N` 的 N | `_last_rifkeys_in_data_lines(data_lines)` → `earned["Rift keys"]` |
| 4 | Keys Total = baseline + delta（delta≤0 时） | `format_display`: `keys_total = baseline_rifkeys + last_rifkeys_val` |
| 5 | keys/h = delta * 3600 / boting_secs | `format_display`: `keys_per_h = last_rifkeys_val * 3600.0 / secs` |

---

## 7. 为何是 883 而不是 1023

- 当前日志下：
  - **baseline** = 886（所有 ts < 00:32:59 的 Session 的 Rift keys 之和）。
  - **delta** = data_lines 中最后一次 `Rift keys Earned` = **-3**（随日志追加会变）。
- 因此：
  - **Keys Total** = 886 + (-3) = **883**（与界面一致）。
  - **keys/h** = -3 × 3600 / boting_secs；当 boting_secs ≈ 817（约 13:37）时，约为 **-13.21/h**（与界面一致）。

若要得到 **1023** 和 **-15.74/h**，需要在该次显示时满足：

- **Keys Total** = 1023 → baseline + delta = 1023，例如 baseline = 1024、delta = -1。
- **keys/h** = -15.74 = delta × 3600 / boting_secs → 若 delta = -1，则 boting_secs ≈ 228（约 3 分 48 秒）。

即：**公式与代码一致**；差异来自**当前日志的 baseline 与 delta**（以及 boting_secs）与「1023 / -15.74」那次运行时的数据不同。
