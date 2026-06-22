#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Debug simulation: Kanai's Cube "Upgrade Rare Item" (yellow -> legendary).

Behavior:
- Runs forever until interrupted (Ctrl+C).
- Each loop upgrades exactly N items (default: 30).
- Prints how many results are Ancient / Primal Ancient per loop.
- Sleeps 0.5 seconds between loops.

Run from pyapps/d3-check:
  python scripts/simulate_kanais_cube_upgrade_rare.py
"""

import os
import sys
import time
import random
import math
from collections import deque
from statistics import NormalDist

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
repo_root = os.path.dirname(os.path.dirname(project_root))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from pycore.pyfoundations.color_print import ColorPrint
from providor.app_constants import (
    D3_LEGENDARY_ANCIENT_RATE,
    D3_LEGENDARY_PRIMAL_RATE,
    D3_KANAI_UPGRADE_RARE_BATCH_SIZE,
    D3_KANAI_UPGRADE_RARE_LOOP_SLEEP_SEC,
    D3_BINOMIAL_CI_ALPHA,
    D3_KANAI_UPGRADE_RARE_STATS_EVERY_LOOPS,
    D3_SPECIAL_ITEM_NAME,
    D3_SPECIAL_ITEM_REFORGE_BATCH_SIZE,
    D3_SPECIAL_ITEM_TRIGGER_POSTERIOR_PROB,
    D3_SPECIAL_ITEM_STOP_POSTERIOR_PROB,
    D3_SPECIAL_ITEM_TARGET_PRIMAL_RATE,
    D3_SPECIAL_ITEM_TRIGGER_MIN_N,
    D3_SPECIAL_ITEM_MAX_CONSECUTIVE_BATCHES,
    D3_SPECIAL_ITEM_WINDOW_N,
    D3_SPECIAL_ITEM_WINDOW_MIN_N,
)


def _simulate_one_upgrade(rng: random.Random) -> str:
    """
    Returns:
      - "primal"  => primal ancient legendary
      - "ancient" => ancient (but not primal) legendary
      - "normal"  => normal legendary
    """
    r = rng.random()
    if r < D3_LEGENDARY_PRIMAL_RATE:
        return "primal"
    if r < D3_LEGENDARY_ANCIENT_RATE:
        return "ancient"
    return "normal"


def _wilson_interval(successes: int, n: int, alpha: float) -> tuple[float, float, float]:
    """
    Wilson score interval for binomial proportion.

    References:
      - Wilson, E. B. (1927). Probable Inference, the Law of Succession, and Statistical Inference.
      - Brown, Cai, DasGupta (2001). Interval Estimation for a Binomial Proportion.
    """
    if n <= 0:
        return (0.0, 0.0, 0.0)
    if successes < 0 or successes > n:
        raise ValueError("successes must be in [0, n].")
    if not (0.0 < alpha < 1.0):
        raise ValueError("alpha must be in (0, 1).")

    phat = successes / n
    z = NormalDist().inv_cdf(1.0 - alpha / 2.0)
    z2 = z * z
    denom = 1.0 + z2 / n
    center = (phat + z2 / (2.0 * n)) / denom
    half = (z / denom) * ((phat * (1.0 - phat) / n + z2 / (4.0 * n * n)) ** 0.5)
    lo = max(0.0, center - half)
    hi = min(1.0, center + half)
    return (phat, lo, hi)


def _beta_log_beta(a: float, b: float) -> float:
    return math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)


def _beta_regularized_incomplete(x: float, a: float, b: float) -> float:
    """
    Regularized incomplete beta I_x(a,b) = B(x; a,b)/B(a,b).

    Implementation based on continued fraction evaluation (Lentz's method),
    as commonly presented in numerical analysis references (e.g. NR).
    This avoids external dependencies (no SciPy) while keeping reasonable accuracy.
    """
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    if a <= 0.0 or b <= 0.0:
        raise ValueError("a and b must be > 0.")

    # Use symmetry to improve convergence.
    if x > (a + 1.0) / (a + b + 2.0):
        return 1.0 - _beta_regularized_incomplete(1.0 - x, b, a)

    ln_front = a * math.log(x) + b * math.log(1.0 - x) - _beta_log_beta(a, b)
    front = math.exp(ln_front) / a

    # Continued fraction for incomplete beta.
    max_iter = 200
    eps = 3e-14
    fpmin = 1e-300

    m2 = 0
    aa = 0.0
    c = 1.0
    d = 1.0 - (a + b) * x / (a + 1.0)
    if abs(d) < fpmin:
        d = fpmin
    d = 1.0 / d
    h = d

    for m in range(1, max_iter + 1):
        m2 = 2 * m

        aa = m * (b - m) * x / ((a + m2 - 1.0) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < fpmin:
            d = fpmin
        c = 1.0 + aa / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        h *= d * c

        aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1.0))
        d = 1.0 + aa * d
        if abs(d) < fpmin:
            d = fpmin
        c = 1.0 + aa / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        delta = d * c
        h *= delta

        if abs(delta - 1.0) < eps:
            break

    return front * h


def _jeffreys_posterior_prob_p_ge(successes: int, n: int, p0: float) -> float:
    """
    Posterior probability P(p >= p0 | data) under Jeffreys prior Beta(1/2, 1/2).

    Reference:
      - Jeffreys, H. (1946). An Invariant Form for the Prior Probability in Estimation Problems.
    """
    if n <= 0:
        return 0.0
    if not (0.0 < p0 < 1.0):
        raise ValueError("p0 must be in (0,1).")
    a = successes + 0.5
    b = (n - successes) + 0.5
    cdf = _beta_regularized_incomplete(p0, a, b)
    return max(0.0, min(1.0, 1.0 - cdf))


def _jeffreys_equal_tailed_ci(successes: int, n: int, alpha: float) -> tuple[float, float, float]:
    """
    Equal-tailed Bayesian credible interval for binomial proportion under Jeffreys prior.

    Practical reference for using Jeffreys interval (and its frequentist properties):
      - Brown, Cai, DasGupta (2001). Interval Estimation for a Binomial Proportion.
    """
    if n <= 0:
        return (0.0, 0.0, 0.0)
    if successes < 0 or successes > n:
        raise ValueError("successes must be in [0, n].")
    if not (0.0 < alpha < 1.0):
        raise ValueError("alpha must be in (0, 1).")

    a = successes + 0.5
    b = (n - successes) + 0.5
    phat = successes / n

    def cdf(p: float) -> float:
        return _beta_regularized_incomplete(p, a, b)

    def inv_cdf(q: float) -> float:
        lo = 0.0
        hi = 1.0
        for _ in range(80):
            mid = (lo + hi) / 2.0
            if cdf(mid) < q:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2.0

    lo_q = alpha / 2.0
    hi_q = 1.0 - alpha / 2.0
    lo = inv_cdf(lo_q)
    hi = inv_cdf(hi_q)
    return (phat, lo, hi)


def main():
    batch = int(D3_KANAI_UPGRADE_RARE_BATCH_SIZE)
    sleep_sec = float(D3_KANAI_UPGRADE_RARE_LOOP_SLEEP_SEC)
    alpha = float(D3_BINOMIAL_CI_ALPHA)
    stats_every = int(D3_KANAI_UPGRADE_RARE_STATS_EVERY_LOOPS)
    special_name = str(D3_SPECIAL_ITEM_NAME)
    special_batch = int(D3_SPECIAL_ITEM_REFORGE_BATCH_SIZE)
    special_trigger_prob = float(D3_SPECIAL_ITEM_TRIGGER_POSTERIOR_PROB)
    special_stop_prob = float(D3_SPECIAL_ITEM_STOP_POSTERIOR_PROB)
    special_p0 = float(D3_SPECIAL_ITEM_TARGET_PRIMAL_RATE)
    special_trigger_min_n = int(D3_SPECIAL_ITEM_TRIGGER_MIN_N)
    special_max_consecutive = int(D3_SPECIAL_ITEM_MAX_CONSECUTIVE_BATCHES)
    window_n = int(D3_SPECIAL_ITEM_WINDOW_N)
    window_min_n = int(D3_SPECIAL_ITEM_WINDOW_MIN_N)

    if D3_LEGENDARY_PRIMAL_RATE <= 0.0 or D3_LEGENDARY_ANCIENT_RATE <= 0.0:
        raise ValueError("Rates must be positive.")
    if D3_LEGENDARY_PRIMAL_RATE >= D3_LEGENDARY_ANCIENT_RATE:
        raise ValueError("Primal rate must be less than or equal to ancient rate.")
    if batch <= 0:
        raise ValueError("Batch size must be > 0.")
    if sleep_sec < 0.0:
        raise ValueError("Sleep seconds must be >= 0.")
    if not (0.0 < alpha < 1.0):
        raise ValueError("CI alpha must be in (0, 1).")
    if stats_every <= 0:
        raise ValueError("stats_every must be > 0.")
    if special_batch <= 0:
        raise ValueError("special reforge batch must be > 0.")
    if not (0.0 < special_trigger_prob < 1.0):
        raise ValueError("special trigger posterior prob must be in (0,1).")
    if not (0.0 < special_stop_prob < 1.0):
        raise ValueError("special stop posterior prob must be in (0,1).")
    if special_stop_prob >= special_trigger_prob:
        raise ValueError("special stop prob must be less than trigger prob (hysteresis).")
    if not (0.0 < special_p0 < 1.0):
        raise ValueError("special target primal rate must be in (0,1).")
    if special_trigger_min_n < 0:
        raise ValueError("special trigger min n must be >= 0.")
    if special_max_consecutive <= 0:
        raise ValueError("special max consecutive batches must be > 0.")
    if window_n <= 0:
        raise ValueError("special window n must be > 0.")
    if window_min_n <= 0 or window_min_n > window_n:
        raise ValueError("special window min n must be in [1, window_n].")

    rng = random.Random()
    loop_idx = 0
    total_upgrades = 0
    total_ancients = 0
    total_primals = 0
    special_reforges = 0
    special_primals = 0
    special_mode = False
    special_consecutive_batches = 0
    recent_primal = deque(maxlen=window_n)  # 1 if primal, else 0

    ColorPrint.blue(
        "[D3] Simulating Kanai upgrade rare -> legendary forever. "
        f"batch={batch} sleep={sleep_sec}s ancient_rate={D3_LEGENDARY_ANCIENT_RATE:.6f} primal_rate={D3_LEGENDARY_PRIMAL_RATE:.6f} ci_alpha={alpha} "
        f"special={special_name} special_batch={special_batch} "
        f"trigger=P(p>={special_p0:.6f})>={special_trigger_prob} stop<{special_stop_prob} "
        f"min_n={special_trigger_min_n} max_consecutive={special_max_consecutive} "
        f"window_n={window_n} window_min_n={window_min_n}"
    )

    try:
        while True:
            loop_idx += 1
            ancient = 0
            primal = 0

            for _ in range(batch):
                result = _simulate_one_upgrade(rng)
                if result == "primal":
                    primal += 1
                    ancient += 1
                    recent_primal.append(1)
                elif result == "ancient":
                    ancient += 1
                    recent_primal.append(0)
                else:
                    recent_primal.append(0)

            total_upgrades += batch
            total_ancients += ancient
            total_primals += primal

            ts = time.strftime("%H:%M:%S")
            ColorPrint.gray(
                f"[{ts}] loop={loop_idx} upgrades={batch} => ancient={ancient} primal={primal} | "
                f"total_upgrades={total_upgrades} total_ancient={total_ancients} total_primal={total_primals}"
            )

            # Sequential decision for special item reforging (continuous phase).
            #
            # Rationale (serious stats): treat the stream as potentially non-stationary; base decisions on a
            # recent-window posterior rather than the entire history, to react to short-term rate changes.
            # This is aligned with sequential monitoring ideas (e.g., Wald's sequential analysis) rather than
            # one-shot fixed-n inference.
            post_prob_all = 0.0
            if total_upgrades >= max(1, special_trigger_min_n):
                post_prob_all = _jeffreys_posterior_prob_p_ge(total_primals, total_upgrades, special_p0)

            w_n = len(recent_primal)
            w_x = int(sum(recent_primal))
            post_prob_win = 0.0
            if w_n >= window_min_n:
                post_prob_win = _jeffreys_posterior_prob_p_ge(w_x, w_n, special_p0)

            if not special_mode:
                # Prefer window-based trigger once enough recent samples exist; fall back to all-time when available.
                can_trigger = False
                trigger_reason = ""
                if w_n >= window_min_n and post_prob_win >= special_trigger_prob:
                    can_trigger = True
                    trigger_reason = f"window P(p>={special_p0:.6f})={post_prob_win:.4f} (x/n={w_x}/{w_n})"
                elif total_upgrades >= special_trigger_min_n and post_prob_all >= special_trigger_prob:
                    can_trigger = True
                    trigger_reason = f"all-time P(p>={special_p0:.6f})={post_prob_all:.4f} (x/n={total_primals}/{total_upgrades})"

                if can_trigger:
                    special_mode = True
                    special_consecutive_batches = 0
                    ColorPrint.green(
                        f"[Special] START reforging {special_name}: {trigger_reason} >= {special_trigger_prob}"
                    )
            else:
                # Stop decision uses window when available, else all-time.
                stop_prob = post_prob_win if w_n >= window_min_n else post_prob_all
                stop_ctx = f"window(x/n={w_x}/{w_n})" if w_n >= window_min_n else f"all-time(x/n={total_primals}/{total_upgrades})"
                if stop_prob < special_stop_prob:
                    special_mode = False
                    special_consecutive_batches = 0
                    ColorPrint.yellow(
                        f"[Special] STOP reforging {special_name}: {stop_ctx} P(p>={special_p0:.6f})={stop_prob:.4f} < {special_stop_prob}"
                    )
                elif special_consecutive_batches >= special_max_consecutive:
                    special_mode = False
                    special_consecutive_batches = 0
                    ColorPrint.yellow(
                        f"[Special] STOP reforging {special_name}: reached max_consecutive_batches={special_max_consecutive} (n={total_upgrades})"
                    )

            if special_mode:
                hit = 0
                for _ in range(special_batch):
                    if rng.random() < D3_LEGENDARY_PRIMAL_RATE:
                        hit += 1
                special_reforges += special_batch
                special_primals += hit
                special_consecutive_batches += 1
                ColorPrint.green(
                    f"[Special] REFORGE batch={special_consecutive_batches}/{special_max_consecutive} "
                    f"P_win={post_prob_win:.4f} P_all={post_prob_all:.4f} => "
                    f"{special_name} x{special_batch}, primal_hits={hit} | "
                    f"special_total_reforge={special_reforges} special_total_primal={special_primals}"
                )

            if loop_idx % stats_every == 0:
                p_a, lo_a, hi_a = _wilson_interval(total_ancients, total_upgrades, alpha)
                p_p, lo_p, hi_p = _wilson_interval(total_primals, total_upgrades, alpha)
                _, j_lo, j_hi = _jeffreys_equal_tailed_ci(total_primals, total_upgrades, alpha)
                post_prob0 = _jeffreys_posterior_prob_p_ge(total_primals, total_upgrades, special_p0)
                post_probw = _jeffreys_posterior_prob_p_ge(w_x, w_n, special_p0) if w_n >= 1 else 0.0
                ColorPrint.blue(
                    f"[Stats] n={total_upgrades} "
                    f"ancient_hat={p_a:.6f} wilson=[{lo_a:.6f}, {hi_a:.6f}] "
                    f"primal_hat={p_p:.6f} wilson=[{lo_p:.6f}, {hi_p:.6f}] "
                    f"jeffreys=[{j_lo:.6f}, {j_hi:.6f}] "
                    f"P_all(p>={special_p0:.6f})={post_prob0:.4f} "
                    f"P_win(p>={special_p0:.6f})={post_probw:.4f} win={w_x}/{w_n} "
                    f"special_mode={'ON' if special_mode else 'OFF'} special_reforge={special_reforges} special_primal={special_primals}"
                )

                if special_reforges > 0:
                    s_p, s_lo, s_hi = _wilson_interval(special_primals, special_reforges, alpha)
                    _, s_j_lo, s_j_hi = _jeffreys_equal_tailed_ci(special_primals, special_reforges, alpha)
                    ColorPrint.blue(
                        f"[Stats.Special] n={special_reforges} primal_hat={s_p:.6f} "
                        f"wilson=[{s_lo:.6f}, {s_hi:.6f}] jeffreys=[{s_j_lo:.6f}, {s_j_hi:.6f}]"
                    )

            if sleep_sec > 0.0:
                time.sleep(sleep_sec)
    except KeyboardInterrupt:
        ColorPrint.yellow(
            f"[D3] Stopped by user. total_upgrades={total_upgrades} total_ancient={total_ancients} total_primal={total_primals} "
            f"special_total_reforge={special_reforges} special_total_primal={special_primals}"
        )


if __name__ == "__main__":
    main()

