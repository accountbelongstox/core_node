# -*- coding: utf-8 -*-
"""
Code Sync wire-transform constants and display helpers (stdlib only).

Shared by the DEV-side PushSender and the CLIENT-side PushReceiver. Holds the
per-file read+compress+encode pipeline tuning plus the human-readable byte /
byte-delta formatters used in both log lines and ack result rows.

Stdlib only; imports nothing internal (safe to import from any codesync module).
"""

PUSH_TICK = 1.0          # seconds between incremental delta pushes
# Cap on accumulated base64 payload per batch. The client persists its
# received-table after EVERY batch ack, so a SMALLER batch = progress saved more
# often = a flapping/intermittent link converges (each brief window delivers and
# keeps more files, instead of losing a big in-flight batch). 3 MB balances that
# against per-batch round-trip overhead (gzip already packs more files per byte).
MAX_BATCH_BYTES = 3 * 1024 * 1024
OFFLINE_RETRY_SECONDS = 60.0
FRAME_FULL_SYNC_COMPLETE = "full_sync_complete"
FRAME_FULL_SYNC_COMPLETE_ACK = "full_sync_complete_ack"

# --- wire transform tuning (the per-file read+compress+encode pipeline) ----- #
GZIP_LEVEL = 6           # zlib level for compressible files (text/code/config)
GZIP_MIN_BYTES = 256     # don't bother compressing tiny files (header overhead)
GZIP_KEEP_RATIO = 0.92   # only ship gzip if it shrinks the file by >8% (else raw)
ENCODE_WORKERS = 4       # threads that read+normalize+gzip+b64 AHEAD of the network
ENCODE_LOOKAHEAD = 12    # max files prepared ahead of the consumer (bounds memory)


# --------------------------------------------------------------------------- #
# Display helpers (shared by sender logs + receiver ack rows)                  #
# --------------------------------------------------------------------------- #
def _fmt_bytes(n: int) -> str:
    """Human-readable byte size (B / KB / MB), stdlib only."""
    try:
        n = float(n)
    except Exception:
        return "0 B"
    if n < 1024:
        return f"{int(n)} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"


def _fmt_diff(diff: int) -> str:
    """Signed byte delta as e.g. '+340 B' / '-1.2 KB' / '0 B'."""
    sign = "+" if diff > 0 else ("-" if diff < 0 else "")
    return f"{sign}{_fmt_bytes(abs(int(diff)))}"
