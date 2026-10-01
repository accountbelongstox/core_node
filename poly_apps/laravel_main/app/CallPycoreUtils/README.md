# Pycore call utilities

Laravel -> pycore RPC. Every call goes through `PycoreHttpClient`.

## Protocol

- Routes: `config/pycore_rpc_contract.json`, read by `App\Support\PycoreRpcContract`.
  `routes.<key>` holds the handler routes and `protocol_routes.<key>` holds
  `status`, `info`, `routes` and `client-id`. Both sit below `api_prefix`. Call by
  route key, never by path.
- Body: a flat JSON object of handler params (GET routes use the query string).
- Success: any 2xx returns pycore's payload raw (204 returns `[]`). A handler
  failure is HTTP 200 with `{success: false, error}`, also returned raw.
- Failure: any other status, a transport error or a non-object body raises
  `PycoreRpcException` (`errorCode` is pycore's `error.code` or
  `pycore_unreachable` / `pycore_transport_failed` / `pycore_invalid_response`,
  plus `httpStatus` and `details`). `payload()` gives the
  `{success: false, error, error_code, http_status, details}` array.
- Endpoint: the `PYCORE_BASE_URL` runtime override, else loopback
  `pycore_backend`, else (WSL) the Windows host from `/etc/resolv.conf`. Each
  candidate is probed with `protocol_routes.status`. The outcome is cached for
  30 s and refreshed by `PycoreUrlDiscoveryTask`.
- Auth: pycore's K7 gate admits loopback callers unsigned. Every other peer is
  signed with K3 client-key headers (`ClientKeyAuthService::signedHeaders`,
  client `laravel_peer`).
- Timeouts: `App\Support\HttpTransfer`. Connect is bounded, there is no total
  deadline, an upload aborts after `http_transfer.idle_timeout_seconds` without
  progress, and TCP keepalive detects a dead peer.

## Facades

- `PycoreTranslatorUtil`: `translateSingle`, `translateBatch` (one
  `translator/translate_batch` per target language, returning
  `[text][target]`), `detectLanguage`.
- `PycoreOCRUtil`: `recognizeImage` / `recognizeBatch` (`local/ocr/recognize`; the
  image is sent as base64 `image_data`), `status` (`local/ocr/status` engine panel).
- `PycoreEdgeTTSUtil`: `synthesize` / `synthesizeToFile` (`tts/synthesize`
  pinned to edge). The local edge-tts binary path (binary assist ON) is
  `EdgeTTSService::synthesizeFile`.
- `App\Services\PycoreAiClient`: `local/ai/status` gateway state for image
  capability.

Diagnostics: `GET /api/octane/timer/pycore/diagnostics`, `POST .../pycore/refresh`.
