# -*- coding: utf-8 -*-
"""
App-level constants for d3-check.

Keep literals centralized here (project rule). Feature modules and scripts should import from here.
"""

# ---------------------------------------------------------------------------
# Diablo III: item quality rates (community long-run averages)
# ---------------------------------------------------------------------------
#
# Notes:
# - Primal Ancient (TaiGu) is a subset of Ancient (YuanGu).
# - These rates are widely cited long-run averages, not Blizzard-official numbers.
#
D3_LEGENDARY_ANCIENT_RATE = 1.0 / 10.0      # ~10%
D3_LEGENDARY_PRIMAL_RATE = 1.0 / 400.0      # ~0.25%

# ---------------------------------------------------------------------------
# Debug simulation: Kanai's Cube "Upgrade Rare Item" batch
# ---------------------------------------------------------------------------
D3_KANAI_UPGRADE_RARE_BATCH_SIZE = 30
D3_KANAI_UPGRADE_RARE_LOOP_SLEEP_SEC = 0.5

# ---------------------------------------------------------------------------
# Debug simulation: statistical reporting
# ---------------------------------------------------------------------------
# Confidence level for binomial proportion intervals (Wilson score interval).
D3_BINOMIAL_CI_ALPHA = 0.05  # 95% CI
# Print full statistical summary every N loops to reduce console spam.
D3_KANAI_UPGRADE_RARE_STATS_EVERY_LOOPS = 10

# ---------------------------------------------------------------------------
# Debug simulation: "special item" reforge strategy (Kanai: Reforge Legendary)
# ---------------------------------------------------------------------------
# The special item itself has the same per-item primal chance; the strategy is
# about *when* to spend reforges based on statistical belief, not changing p.
D3_SPECIAL_ITEM_NAME = "special_item"
# How many reforges to do once a trigger happens.
D3_SPECIAL_ITEM_REFORGE_BATCH_SIZE = 20
# Trigger: posterior probability P(p >= target) must exceed this to start a batch.
D3_SPECIAL_ITEM_TRIGGER_POSTERIOR_PROB = 0.8
# Stop condition (hysteresis): if posterior probability falls below this, stop reforging and resume sampling.
D3_SPECIAL_ITEM_STOP_POSTERIOR_PROB = 0.6
# Target primal rate to compare against (hypothesis threshold).
D3_SPECIAL_ITEM_TARGET_PRIMAL_RATE = D3_LEGENDARY_PRIMAL_RATE
# Minimum number of total legendary samples before allowing trigger (avoid noise).
D3_SPECIAL_ITEM_TRIGGER_MIN_N = 2000
# Once triggered, do at most this many batches consecutively before forcing a return to sampling.
D3_SPECIAL_ITEM_MAX_CONSECUTIVE_BATCHES = 10

# Rolling-window evidence (non-stationary monitoring): use the most recent samples
# to decide whether to enter/exit a continuous reforging phase.
D3_SPECIAL_ITEM_WINDOW_N = 1200
D3_SPECIAL_ITEM_WINDOW_MIN_N = 300

