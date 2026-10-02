# Code Sync Workspace API (frozen)

Scope: the frozen client-hosted workspace API for exchanging fix documents and files with a client tree.

Authority: code > config/*_contract.json > this document. Code: `pycore/pyutils/codesync/workspace_exchange.py`, `service.py`, `file_operations.py`, `pycore/callmodule/rpc_routes/code_sync_routes.py`.

## Status

Code Sync (`pycore/pyutils/codesync`) is retired and frozen: not started by default, not updated. Code moves between machines with `gitsync` (`DESIGN_PYCORE_CORE.md` section 11). Use this API only where a client still runs the frozen host.

## Minimum still needed

- Host: role `client`, not light; full pycore with `CODESYNC_ENABLED=1`, or `pyservice.sh codesync run` / `pyservice.ps1 codesync run`. Base URL `http://<client-host>:59000/code-sync` (port `pycore_backend` in `config/service_contract.json`). LAN access needs `pyservice config system set --key rpcLanBind --value true`. Outside a private network use TLS, a tailnet/VPN or an SSH tunnel.
- Auth: every request, loopback included, carries the K3 `X-Core-Node-*` signature (`config/service_contract.json#client_key_auth`) over the exact body bytes; sign with `pycore.pyutils.common.client_key_auth.client_key_headers(method, url, body_bytes, content_type)` or Node `signRequest` (`ncore/foundation/common/client_key_auth.js`). Failure: 401 `{"success": false, "error": "<client_key_* code>"}`.
- JSON over UTF-8; file bytes as Base64 `content_base64`; version = SHA-256 of the raw bytes, returned as `sha256`, quoted `etag` and the `ETag` header. Paths are `/`-relative to the `core_node` root; absolute, drive, empty, `.` and `..` segments and targets resolving outside the root are 400.

| Route | Purpose |
|---|---|
| `GET /code-sync/workspace` | capabilities and route list |
| `GET /code-sync/workspace/files?cursor=&limit=1000&include_hash=false` | top-level `docs_fix/*.md` regular files by name; `limit` 1-5000; repeat with `next_cursor` while `has_more` |
| `GET /code-sync/workspace/file?path=` | read any contained file: `content_base64`, `size`, `mtime_ns`, `sha256`, `etag` |
| `PUT /code-sync/workspace/file?path=` | body `{content_base64, content_sha256?}`; `If-Match: "<etag>"` to update, `If-None-Match: *` to create; identical content returns 200 `changed: false` before any precondition check; atomic write keeping the file mode |
| `POST /code-sync/workspace/documents` | body `{title, content}`; writes `docs_fix/<safe-title>-<sha256(title)[:12]>.md` with front matter (`codesync_document`, `document_id = SHA-256(title + NUL + content)`, `title`, `updated_at`); same id returns 200 `changed: false` |
| `GET /code-sync/workspace/documents/latest` | newest listed document; uploaded documents return their title and body, plain files their stem and full text |

Status codes: 200 ok or idempotent repeat, 201 created, 400 invalid input, 401 signature, 404 not found, 409 target not a regular file, 412 precondition failed, 422 `content_sha256` mismatch, 428 write without precondition, 503 not a client or light mode. Errors are `{"success": false, "error": "<description>"}`.
