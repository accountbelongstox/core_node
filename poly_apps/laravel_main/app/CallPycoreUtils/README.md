# Pycore HTTP Call Utilities

This directory contains utilities for calling Pycore RPC services via HTTP.

## Overview

The Pycore RPC server runs at `http://127.0.0.1:59000` and provides various services through an async RPC interface.

## Components

### PycoreHttpClient

Base HTTP client for making RPC calls to the Pycore server.

**Methods:**

- `call(string $route, array $params, int $timeout, bool $async)`: Makes RPC call with async polling
- `callDirect(string $endpoint, array $params, int $timeout)`: Direct HTTP POST (for REST endpoints)
- `queryResult(string $requestId)`: Query result of async RPC call

**Usage:**

```php
// Async RPC call (auto-polling)
$response = PycoreHttpClient::call(
    'translator.translate_single',
    ['text' => 'Hello', 'src' => 'en', 'dest' => 'zh-cn'],
    60,
    false  // false = wait for result (poll), true = return immediately
);

if (isset($response['success']) && $response['success']) {
    $result = $response['result'];
}
```

### PycoreTranslatorUtil

Google Translate wrapper using Pycore RPC service.

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
    echo $result['translated_text'];  // 你好世界
}

// Batch translation
$results = PycoreTranslatorUtil::translateBatch(
    ['Hello'],
    'en',
    ['zh-cn', 'ja', 'ko']
);
```

## Pycore RPC Server

The RPC server must be running at `http://127.0.0.1:59000`.

**Available Modules:**

- `translator.translate_single`: Translate single text
- `translator.translate_batch`: Batch translate multiple texts
- `translator.detect_language`: Detect language

**Server Management:**

```bash
# Start server (if not running)
cd /www/programing/core_node
python3 -m pycore.callmodule --port 59000

# Check server status
curl http://127.0.0.1:59000/

# Check available routes
curl http://127.0.0.1:59000/ | jq .
```

## How RPC Works

### Synchronous Mode (default for translator)

1. Client sends POST to `/rpc/{route}` with parameters
2. Server returns immediate response with `sync_response: true` and `result` field
3. No polling needed

### Asynchronous Mode

1. Client sends POST to `/rpc/{route}` with parameters
2. Server returns request ID and status: `accepted`
3. Client polls `/rpc/query/{request_id}` until status is `completed` or `failed`
4. Result is returned in `result` field

**Note:** `PycoreHttpClient::call()` automatically detects sync vs async responses:
- Sync: Returns result immediately
- Async: Polls automatically when `$async = false`

## Error Handling

All methods return arrays with either:

**Success:**
```php
[
    'success' => true,
    'result' => [...],
    'request_id' => '...',
    'elapsed' => 2
]
```

**Error:**
```php
[
    'error' => 'Error message',
    'details' => [...],
    'request_id' => '...'
]
```

Always check for `error` key before accessing `result`.
