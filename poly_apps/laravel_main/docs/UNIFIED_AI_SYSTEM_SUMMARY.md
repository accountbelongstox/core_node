# Unified AI System Summary

**Date**: 2025-12-01
**Status**: ✅ Completed

---

## Overview

Created a unified AI adapter system that intelligently routes requests to the appropriate AI provider based on task type, availability, and rate limits.

---

## System Architecture

### Components

```
┌─────────────────────────────────────────────────┐
│          UnifiedAIRouter (Main Entry)           │
│  - Intelligent routing based on task type       │
│  - Provider fallback logic                      │
│  - Unified interface for all AI requests        │
└─────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ OpenRouter   │ │  DeepSeek    │ │   Gemini     │
│ (Text)       │ │  (Text)      │ │ (Multimodal) │
│ Priority: 1  │ │ Priority: 2  │ │ Priority: 1  │
└──────────────┘ └──────────────┘ └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │ UnifiedRateLimiter    │
            │ - Per-provider limits │
            │ - Per-key limits      │
            │ - Keyword-based limits│
            │ - JSON file storage   │
            └───────────────────────┘
```

---

## Providers Configuration

### 1. OpenRouter

**File**: `app/Services/AI/OpenRouterClient.php`

**Capabilities**:
- ✅ Text generation only
- ❌ No image generation
- ❌ No image analysis

**Rate Limits**:
```php
'rpm' => 20,   // 20 requests per minute
'rpd' => 1000, // 1000 requests per day
```

**Priority**: **Primary text provider** (Priority 1)

**API Key**: `OPENROUTER_API_KEY` in `.secret_keys/.secret_ignore/`

**Models**:
- `meta-llama/llama-3.1-8b-instruct:free` (Default)
- `google/gemini-flash-1.5`
- `anthropic/claude-3-5-sonnet`

---

### 2. DeepSeek

**File**: `app/Services/AI/DeepSeekClient.php`

**Capabilities**:
- ✅ Text generation only
- ❌ No image generation
- ❌ No image analysis

**Rate Limits**:
```php
'rpm' => 1000,   // Virtually unlimited (paid)
'rpd' => 100000, // Virtually unlimited (paid)
```

**Priority**: **Fallback text provider** (Priority 2)

**API Key**: `DEEPSEEK_API_KEY` in `.secret_keys/.secret_ignore/`

**Models**:
- `deepseek-chat` (Default)
- `deepseek-coder`

**Note**: Paid service, no hard limits but costs money per request

---

### 3. Gemini

**File**: `app/Services/GeminiClient.php` (Already exists)

**Capabilities**:
- ✅ Text generation
- ✅ Image generation
- ✅ Image analysis
- ✅ Document analysis
- ✅ Multimodal tasks

**Rate Limits** (per key):
```php
'rpm' => 25,   // 25 requests per minute
'tpm' => 250000, // 250k tokens per minute
'rpd' => 100,  // 100 requests per day
```

**Priority**: **Primary multimodal provider** (Priority 1)

**API Keys**: `GOOGLE_API_KEY_1`, `GOOGLE_API_KEY_2` (Automatic rotation)

**Key Rotation**: ✅ **Yes - Automatically skips rate-limited keys**

**Models**:
- `gemini-2.5-flash`
- `gemini-2.0-flash-exp`
- `gemini-1.5-flash`
- `gemini-1.5-pro`
- `gemini-2.5-flash-image` (for image generation)

---

## Routing Logic

### Task Type Routing

| Task Type | Primary Provider | Fallback Provider | Reason |
|-----------|-----------------|-------------------|---------|
| `text`, `chat` | OpenRouter | DeepSeek | Free daily quota, then paid backup |
| `image_generate`, `image_gen` | Gemini | None | Only Gemini supports image gen |
| `image_analyze`, `vision` | Gemini | None | Only Gemini supports vision |
| `document_analyze`, `multimodal` | Gemini | None | Only Gemini supports multimodal |

### Routing Algorithm

```
1. User calls UnifiedAIRouter::request($taskType, $params)
   ↓
2. Router determines task type
   ↓
3. For TEXT tasks:
   ├─ Try OpenRouter
   │  ├─ If success → Return result ✅
   │  └─ If rate limited → Try DeepSeek
   │     ├─ If success → Return result ✅
   │     └─ If failed → Return error ❌
   │
4. For IMAGE/VISION tasks:
   └─ Use Gemini only
      ├─ Gemini auto-rotates keys if rate limited
      ├─ If all keys limited → Return rate limit error
      └─ If success → Return result ✅
```

---

## Gemini Key Rotation Verification

### ✅ Confirmed: Gemini Automatically Rotates Keys

**Code Analysis**: `app/Services/GeminiClient.php:618-661`

```php
private function acquireApiKey(...) {
    // Iterates through all keys in keyPool
    foreach ($this->keyPool as $entry) {
        $result = $this->reserveUsage($entry, ...);

        // If key is allowed, use it
        if ($result['allowed'] ?? false) {
            return ['success' => true, 'key' => $entry['key']];
        }

        // Key is rate limited, record failure
        $failures[] = [...];
    }

    // Only returns rate_limited when ALL keys are exhausted
    return [
        'success' => false,
        'error' => 'All Gemini API keys are rate limited',
        'rate_limited' => true,
    ];
}
```

**Behavior**:
1. ✅ Tries GOOGLE_API_KEY_1 first
2. ✅ If KEY_1 is rate limited, automatically tries KEY_2
3. ✅ Returns rate_limited only when **all keys** are exhausted
4. ✅ Each key has independent rate limit tracking via JSON files

---

## Unified Rate Limiter

**File**: `app/Services/AI/UnifiedRateLimiter.php`

**Features**:
- ✅ Per-provider rate limiting
- ✅ Per-key rate limiting
- ✅ Keyword-based rate limiting
- ✅ Minute/day windows
- ✅ Token counting support
- ✅ File-based storage with locking
- ✅ Atomic operations

**Storage Location**: `cache/ai_rate_limits/rate_{provider}_{keyId}.json`

**Limits Supported**:
```php
'rpm'         => Requests per minute
'tpm'         => Tokens per minute
'rpd'         => Requests per day
'tpd'         => Tokens per day
'keyword_rpm' => Requests per minute per keyword
```

**Example Usage**:
```php
$limiter = new UnifiedRateLimiter();

$result = $limiter->acquire(
    'openrouter',          // provider
    'key1_abc123',         // key identifier
    ['rpm' => 20],         // limits
    1,                     // requests
    0,                     // tokens
    'translate'            // keyword (optional)
);

if (!$result['allowed']) {
    // Rate limited
    $retryAfter = $result['retry_after'];
}
```

---

## Usage Examples

### Text Generation

```php
$router = new UnifiedAIRouter();

// Simple chat
$result = $router->chat('What is Laravel?', null, 'docs');

// With system prompt
$result = $router->request('text', [
    'prompt' => 'Translate this to French',
    'system_prompt' => 'You are a translator',
    'keyword' => 'translate',
]);

// Result
[
    'success' => true,
    'text' => 'Laravel est un framework...',
    'provider' => 'openrouter',
    'routed_by' => 'UnifiedAIRouter',
]
```

### Image Generation

```php
$router = new UnifiedAIRouter();

// Generate image
$result = $router->generateImage(
    'A beautiful sunset over mountains',
    ['size' => '1024x1024']
);

// Result
[
    'success' => true,
    'binary' => (binary data),
    'width' => 1024,
    'height' => 1024,
    'provider' => 'gemini',
]
```

### Image Analysis

```php
$router = new UnifiedAIRouter();

// Analyze image
$result = $router->analyzeImage(
    '/path/to/image.jpg',
    'What objects are in this image?'
);

// Result
[
    'success' => true,
    'text' => 'The image contains...',
    'provider' => 'gemini',
]
```

---

## sys:init Integration

### Output Example

```bash
php artisan sys:init

# ...

Verifying AI providers...
  ✅ openrouter: Available (text) (Priority: 1)
     Minute: 0 requests
     Day: 0 requests
  ❌ deepseek: Not configured (text) (Priority: 2)
  ✅ gemini: Available (multimodal) (Priority: 1)

# ...
```

**Verification**:
- ✅ Checks if API keys are configured
- ✅ Shows provider type and priority
- ✅ Displays current usage statistics
- ✅ Indicates which providers are available

---

## Provider Priority Strategy

### Why This Order?

1. **OpenRouter First (Text)**
   - ✅ 1000 free requests per day
   - ✅ No cost
   - ✅ Good quality models
   - ❌ Limited to 20 req/min

2. **DeepSeek Second (Text)**
   - ✅ Unlimited requests
   - ✅ High quality
   - ❌ Paid service (costs money)
   - 💡 Only used when OpenRouter is exhausted

3. **Gemini (Images/Vision)**
   - ✅ Only provider with image capabilities
   - ✅ Multi-key rotation
   - ✅ 25 req/min per key
   - ❌ Only 100 req/day per key

---

## Keyword-Based Rate Limiting

### Use Case

Prevent abuse of specific features:

```php
// Translation requests limited to 10/min
$router->request('text', [
    'prompt' => 'Translate: Hello',
    'keyword' => 'translate',
]);

// Configure in limiter
$limiter->acquire(..., [
    'rpm' => 20,
    'keyword_rpm' => 10,  // Max 10 translation requests/min
], ..., 'translate');
```

**Benefits**:
- ✅ Prevent single feature from consuming all quota
- ✅ Fair usage across different use cases
- ✅ Granular control

---

## Rate Limit Storage

### File Structure

```
cache/ai_rate_limits/
├── rate_openrouter_key1_abc123.json
├── rate_deepseek_key1_xyz789.json
├── rate_gemini_key1_def456.json
└── rate_gemini_key2_ghi012.json
```

### File Format

```json
{
  "minute": {
    "start": 1733043600,
    "requests": 12,
    "tokens": 2400
  },
  "day": {
    "date": "2025-12-01",
    "requests": 87,
    "tokens": 17400
  },
  "keywords": {
    "translate": {
      "start": 1733043600,
      "requests": 5,
      "tokens": 1000
    }
  }
}
```

---

## API Methods

### UnifiedAIRouter

```php
// Main entry point
$router->request(string $taskType, array $params): array

// Helper methods
$router->chat(string $prompt, ?string $systemPrompt, ?string $keyword): array
$router->generateImage(string $prompt, array $options): array
$router->analyzeImage(string $imagePath, string $prompt): array

// Status methods
$router->getProvidersStatus(): array
$router->getRecommendedProvider(string $taskType): array
```

### Individual Clients

```php
// OpenRouter
$openRouter->chat($prompt, $model, $systemPrompt, $options, $keyword): array
$openRouter->getModels(): array
$openRouter->getUsageStats(): array

// DeepSeek
$deepSeek->chat($prompt, $model, $systemPrompt, $options, $keyword): array
$deepSeek->getModels(): array
$deepSeek->getUsageStats(): array

// Gemini (existing)
$gemini->generateImageFromPrompt($prompt, $options): array
$gemini->analyzeImage($imagePath, $prompt, $model, $timeout): array
$gemini->chat($prompt, $model, $systemPrompt, $extra, $timeout): string
```

---

## Files Created

```
✅ app/Services/AI/UnifiedRateLimiter.php       (360 lines)
✅ app/Services/AI/OpenRouterClient.php         (220 lines)
✅ app/Services/AI/DeepSeekClient.php           (210 lines)
✅ app/Services/AI/UnifiedAIRouter.php          (350 lines)
✅ UNIFIED_AI_SYSTEM_SUMMARY.md                 (this file)
```

### Modified Files

```
✅ app/Console/Commands/InitializeApps.php      (Added AI verification)
```

---

## Error Handling

### Rate Limit Response

```php
[
    'success' => false,
    'error' => 'Rate limit exceeded',
    'rate_limited' => true,
    'retry_after' => 45,           // seconds
    'reason' => 'minute_requests_exceeded',
    'limit' => 20,
    'current' => 20,
]
```

### Provider Unavailable

```php
[
    'success' => false,
    'error' => 'No text provider available',
    'details' => 'Both OpenRouter and DeepSeek are unavailable',
]
```

### API Error

```php
[
    'success' => false,
    'error' => 'Invalid API key',
    'provider' => 'openrouter',
]
```

---

## Testing Checklist

### Configuration

- [ ] Add `OPENROUTER_API_KEY` to secret keys
- [ ] Add `DEEPSEEK_API_KEY` to secret keys (optional)
- [ ] Verify `GOOGLE_API_KEY_1` and `GOOGLE_API_KEY_2` exist

### Basic Tests

- [ ] Run `php artisan sys:init` - verify AI providers section
- [ ] Test text generation with OpenRouter
- [ ] Test fallback to DeepSeek when OpenRouter is limited
- [ ] Test image generation with Gemini
- [ ] Test image analysis with Gemini
- [ ] Verify Gemini key rotation works

### Rate Limit Tests

- [ ] Exhaust OpenRouter quota, verify fallback
- [ ] Exhaust Gemini KEY_1, verify rotation to KEY_2
- [ ] Test keyword-based limiting
- [ ] Verify rate limit storage in cache directory

---

## Migration from Direct Client Usage

### Before (Direct)

```php
// Old way - direct client
$gemini = new GeminiClient();
$result = $gemini->chat('Hello');
```

### After (Unified)

```php
// New way - unified router
$router = new UnifiedAIRouter();
$result = $router->chat('Hello');
// Automatically uses OpenRouter, falls back to DeepSeek
```

**Benefits**:
- ✅ Automatic provider selection
- ✅ Built-in fallback
- ✅ Unified rate limiting
- ✅ Keyword tracking

---

## Future Enhancements

1. ✨ Add more providers (Claude API, etc.)
2. ✨ Cost tracking per provider
3. ✨ Usage analytics dashboard
4. ✨ Auto-scaling based on budget
5. ✨ Provider health monitoring

---

**End of Summary**
