# Pycore Global Route Recovery

## Recovery identity

The browser keeps one Pycore-assigned client ID in global local storage and
migrates an existing tab identity once. The shared HTTP client attaches the ID
to every request. Feature modules do not allocate or duplicate identity state.

The SSE transport persists its server instance and sequence cursor per Pycore
ID. Refreshes and reconnects therefore continue from the last network event.
A server restart or lost replay window triggers one bounded reconciliation.

## Route and page state

One bounded recovery store owns cached responses by Pycore ID, route, and
stable request parameters. Agent History ID pages, Agent History runtime,
Code Sync runtime, and LLM status use this shared store. Entries are size- and
count-limited, and old client identities are evicted.

Code Sync now restores one combined runtime page containing mesh, settings, and
the first DIFF log page. Stable log IDs and revisions allow an unchanged reply
without copying the log list. Long-connection `code_sync_update` and
`code_sync_log` events update the browser cache directly. A full runtime read is
reserved for first use without recovery data, replay loss, server restart, or a
state-changing action. The former independent peer and log polling ownership is
removed.

## Cached status and visible progress

LLM capability status uses the shared Pycore status snapshot cache and one
browser runtime owner. Repeated mounts reuse the recovered route result rather
than rerunning capability inspection.

Operation item transitions publish status, stage, and progress from the common
commit path. Agent History applies these events to its recovered runtime and
shows the current item, completion ratio, and progress bar while automatic
history processing is active.

No environment-variable configuration was added. No tests, builds, or services
were run, as required by repository instructions.
