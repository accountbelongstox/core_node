# MCP Word Repair Queue and WebSocket Refresh

The Unified Task Center previously derived every summary card and drill-down from `global_tasks` and `/assist/overview/items`. The word-validity runner does not use that source: it pulls unchecked or untranslated rows directly from the per-language dictionary tables. This source mismatch hid the backend repair backlog even while dictionary explanation and word-image cards were visible.

The validity pending endpoint now supports the worker-compatible first-page request plus bounded UI reads with `languages`, `start`, `limit`, `q`, and `include_total`. Laravel selects an ID-only page first, materializes only that page through the shared DIFF catalog, and compacts the data segment after response assembly. The segment size is capped by the shared queue contract.

On Ready, mcp-chrome requests the selected validity languages, the exact pending total, and the first 20 repair rows. It merges the total into the canonical `word_validity` summary card. Opening the card reuses the first segment and lazily requests later pages or searches from Laravel. DeepSeek worker requests remain compatible with the same endpoint and do not request an expensive total.

Queue Center live updates now use Laravel Reverb instead of the former five-second popup poll. The overview exposes public WebSocket connection metadata from server configuration. Dictionary and global-task writes emit a coalesced `queue.changed` revision signal on the public `queue-center` channel; the popup refreshes only the summary and visible page. Reconnect uses bounded exponential backoff, and WebSocket messages never carry full queue rows.

`BROADCAST_CONNECTION` is set to `reverb` for the local Laravel runtime, whose existing Windows and Linux launch paths already include the Reverb process.

No build, test, service, or runtime verification command was run, per repository instructions.
