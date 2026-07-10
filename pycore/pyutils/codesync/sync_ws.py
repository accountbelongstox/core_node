# -*- coding: utf-8 -*-
"""
Code Sync WebSocket push channel (stdlib only).

Direction (per the topology): the DEV is behind NAT and CANNOT be reached, so the
**clients are the WS servers** and the **dev dials out** to each of them and PUSHES
file changes. This flips the old HTTP pull model (client->dev), which NAT blocked.

  * PushSender   (DEV side)    -- for each client peer, open an outbound WS
    (ws_client). The supervisor (which OUTLIVES individual push threads) owns a
    persistent per-client state dict so a client that was offline still receives
    files that changed while it was gone (resume), and a dead peer is retried with
    exponential backoff instead of being respawned every few seconds.
  * PushReceiver (CLIENT side) -- handle pushed messages on a WS the client accepted
    (the stdlib http_server upgrade / FastAPI WS calls handle_text): write the files
    under the watched root, SKIP if the hash already matches, log + phase.

Message protocol (JSON text frames):
  dev->client  {"type":"hello","dev_id","dev_name"}
  client->dev  {"type":"welcome","client_id","name"}

  BATCHED (current):
  dev->client  {"type":"batch","reason":"full"|"resume"|"delta","dev_id","dev_name","files":[
                   {"rel","mtime","hash","size","b64"[, "enc":"gzip"]}, ...]}  # create / modify
                 # reason is informational (the receiver ignores it): "full" = full-
                 # sync batch, "resume" = first batch after a reconnect, "delta" = live
  client->dev  {"type":"batch_ack","results":[
                   {"rel","status":"written"|"skipped"|"error",
                    "diff":<int>,"size":<int>,"error"?:<str>}, ...]}

  UPDATE-ONLY: the dev no longer sends deletes and the client NEVER removes local
  files. A legacy `{"rel","deleted":true}` entry from an older dev is acked +
  ignored (status "skipped"), so the client keeps everything it has.

  LEGACY (kept for back-compat with older peers):
  dev->client  {"type":"file","rel","mtime","hash","b64"}
  client->dev  {"type":"ack","rel","status":"written"|"skipped"|"error"}
  dev->client  {"type":"batch_done","count"}

This module is a thin re-export shim: the implementation lives in the sibling
sub-modules (push_sender / push_receiver / wire_codec), kept stdlib-only. The
public API (PushSender / PushReceiver) is preserved so `from .sync_ws import ...`
keeps working.
"""

from .push_receiver import PushReceiver
from .push_sender import PushSender

__all__ = ["PushReceiver", "PushSender"]
