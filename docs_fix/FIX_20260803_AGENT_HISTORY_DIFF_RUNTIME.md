# Agent History DIFF Runtime and Client Identity Fix

## Removed UI surface

Voice & Subtitle is no longer a Pycore Manager page or navigation item. Agent
History is the manager index page. The legacy `voice-subtitle`, `voice-player`,
and `subtitle` paths redirect to Agent History. The underlying compatibility
services remain isolated so unrelated native and automation callers are not
broken.

## Duplicate request cause

The article configuration effect depended on a translation callback recreated
by every parent render. Loading configuration updated the parent tool filter,
which recreated the callback and restarted the same request. The configuration
and log panels also subscribed independently to `operation.changed`, while the
record list reloaded on every operation progress event.

Agent History now owns one browser runtime store. Configuration and operation
state come from the single `ui/agent_history/runtime_get` exchange; the former
`article_config_get` route was removed. Operation reconciliation has one
snapshot flight. The page owns one long-connection subscription. Operation
events update the cached log immediately. Snapshot reconciliation is trailing
and bounded to at most one read per five-second activity window. Article records
listen only to `article.published`.

## DIFF ID pages

Session, prompt, and article-record ID pages are persisted independently by
scope, filter, and page number. Only the visible page IDs are requested and
only those rows are materialized. Every ID-page request sends its cached
revision. When the revision matches, Pycore returns `unchanged` before reading
or filtering the index, prompt catalog, or article-record index. The browser
also records the materialized scope and revision, so an unchanged ID response
does not trigger another body-page request. Parsed session summaries and their
ID lookup table are cached centrally by the persistent `index.txt` revision.

The extractor persists a stable `source_id` for each discovered history source
and compares current IDs with the existing source-ID catalog before parsing.
Session summaries now persist `ended_ts`; the article planner skips session IDs
strictly behind each tool's durable high-water cursor without reading their
full transcript files.

## Pycore-assigned client identity

The central HTTP protocol exposes `POST /api/client-id`. Pycore allocates one
bounded ID for a browser identity. The Pycore base API client obtains and
globally persists that ID before opening the SSE connection or issuing API
requests. Every GET and POST then carries it in `X-Pycore-Client-ID`; feature
code does not implement its own identity field. Legacy tab IDs migrate once.
The allocation handshake uses the shared three-second Pycore health ceiling and
the SSE controller retries it without creating parallel connections. The last
SSE instance and sequence cursor are persisted per Pycore ID, so refresh and
reconnect resume from the last received event instead of replaying from zero.

No environment-variable configuration was added. No tests, builds, or services
were run, as required by repository instructions.
