# Pycore HTTP Call Utilities

Utilities for calling pycore's rpc_v2 HTTP server from Laravel.

## Overview

The pycore rpc_v2 server (`pycore/pyutils/rpc_v2/server.py`) listens on
`http://127.0.0.1:59000` (PYCORE_HTTP_PORT in
`pycore/pyfoundations/network_constants.py`) and exposes every registered
route under the `/api` prefix. The protocol is fully synchronous:

1. Client sends `POST /api/{route}` with a flat JSON object body; the body
   keys are passed to the handler as its params dict (no request envelope).
2. Success: HTTP 200 with the handler's return value as the JSON body
   (HTTP 204 when the handler returns null). There is no response envelope.
3. Transport/protocol failure: HTTP 4xx/5xx with
   `{"success": false, "error": {"code": ..., "message": ...}, "route": ..., "request_id": ...}`.
4. Handler-level failure: HTTP 200 with `{"success": false, "error": "..."}`.

There is no async mode and no polling endpoint in rpc_v2.

## Components

### PycoreHttpClient

Base HTTP client for rpc_v2 calls.

**Method:**

- `call(string $route, array $params, int $timeout)`: POST to
  `/api/{route}`; returns `['success' => true, 'result' => <handler payload>]`
  or `['error' => <message>, ...]`.

**Usage:**

```php
$response = PycoreHttpClient::call(
    'translator/translate_single',
    ['text' => 'Hello', 'src' => 'en', 'dest' => 'zh-cn'],
    60
);

if (isset($response['success']) && $response['success']) {
    $result = $response['result'];
}
```

### PycoreTranslatorUtil

Google Translate facade over the pycore translator routes.

**Methods:**

- `translateSingle(string $text, string $src, string $dest, bool $useCache)`: Translate single text
- `translateBatch(array $texts, string $src, array $dests, bool $useCache)`: Batch translate
- `detectLanguage(string $text)`: Detect language

**Usage:**

```php
use App\CallPycoreUtils\PycoreTranslatorUtil;

// Single translation
$result = PycoreTranslatorUtil::translateSingle('Hello world', 'en', 'zh-cn');

if (!isset($result['error'])) {
    echo $result['translated_text'];
}

// Batch translation
$results = PycoreTranslatorUtil::translateBatch(
    ['Hello'],
    'en',
    ['zh-cn', 'ja', 'ko']
);
```

## Pycore Translator Routes

Registered in `pycore/callmodule/rpc_routes/route_names.py` and served by
`pycore/pyctl/translation/manual_translation_service.py`:

- `translator/translate_single`: params `text`, `src` (default `auto`),
  `dest` (default `en`), `use_cache` (default true). Returns
  `{success, provider, original_text, translated_text, src, dest, src_lang, dest_lang, pronunciation, from_cache}`.
- `translator/translate_batch`: params `texts` (array), `src`, `dest`,
  `use_cache`. Returns `{success, provider, src, dest, results: [...]}` where
  each item carries `original_text`, `translated_text`, `src_lang`,
  `dest_lang`, `pronunciation`, `from_cache`, `error`.
- `translator/detect_language`: param `text`. Returns
  `{success, provider, language, confidence, text}`.

## Server Management

```bash
# Start the pycore server (if not running)
python3 -m pycore.callmodule

# Check server status
curl http://127.0.0.1:59000/api/status

# List available routes
curl http://127.0.0.1:59000/api/routes
```

## Error Handling

All client methods return arrays. Always check for the `error` key before
accessing `result`:

**Success:**
```php
[
    'success' => true,
    'result' => [...],  // handler payload
]
```

**Error:**
```php
[
    'error' => 'Error message',
    'status' => 404,      // when the HTTP call itself failed
    'details' => [...],   // raw server payload when available
]
```
