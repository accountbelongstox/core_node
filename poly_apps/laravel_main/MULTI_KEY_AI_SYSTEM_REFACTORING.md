# Multi-Key AI System Refactoring

**Date**: 2025-12-03
**Status**: ✅ Completed
**By**: Claude AI Assistant

---

## 📋 Overview

Refactored the AI provider system to support **automatic multi-key discovery and rotation** with **dynamic rate limit scaling**. This enables the system to utilize multiple API keys for each provider, automatically rotating between them and multiplying effective rate limits.

---

## 🎯 Key Features

### 1. Automatic Key Discovery

The system now automatically scans for API keys using this pattern:

```
PROVIDER_KEY         # Base key (no suffix)
PROVIDER_KEY_1       # First numbered key
PROVIDER_KEY_2       # Second numbered key
PROVIDER_KEY_3       # Third numbered key
...                  # Up to PROVIDER_KEY_10
```

**Example for OpenRouter**:
- `OPENROUTER_API_KEY`
- `OPENROUTER_API_KEY_1`
- `OPENROUTER_API_KEY_2`

**Example for DeepSeek**:
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_API_KEY_1`
- `DEEPSEEK_API_KEY_2`

**Example for Google Gemini** (already supported):
- `GOOGLE_API_KEY_1`
- `GOOGLE_API_KEY_2`

### 2. Dynamic Rate Limit Scaling

Rate limits automatically scale based on the number of keys:

| Keys | OpenRouter (per key: 20 req/min) | Effective Limit |
|------|----------------------------------|-----------------|
| 1    | 20 req/min                       | 20 req/min      |
| 2    | 20 req/min each                  | **40 req/min**  |
| 3    | 20 req/min each                  | **60 req/min**  |

**Formula**: `Effective Limit = Base Limit × Number of Keys`

### 3. Automatic Key Rotation

When making requests:
1. System tries **Key 1** → If rate limited, try next key
2. System tries **Key 2** → If rate limited, try next key
3. System tries **Key 3** → If rate limited, try next key
4. If all keys are rate limited → Return error with retry_after

This provides **automatic failover** and **load balancing** across all available keys.

---

## 🏗️ Architecture

### New Base Class: `MultiKeyAIClientBase`

Created a new abstract base class that handles multi-key functionality:

**File**: `app/Services/AI/MultiKeyAIClientBase.php` (298 lines)

**Features**:
- ✅ Auto-discovery of API keys from secret files
- ✅ Key pool management
- ✅ Key rotation logic
- ✅ Dynamic rate limit calculation
- ✅ Per-key usage tracking
- ✅ Aggregate statistics

**Methods**:
```php
protected function resolveApiKeys(string $keyPrefix, ?string $override): array
protected function buildKeyIdentifier(int $index, string $key): string
public function hasApiKey(): bool
public function getKeyCount(): int
public function getEffectiveRateLimits(): array
protected function acquireApiKey(int $requests, int $tokens, ?string $keyword): array
public function getUsageStats(): array
public function getProviderInfo(): array
```

---

## 📁 Refactored Files

### 1. OpenRouterClient

**File**: `app/Services/AI/OpenRouterClient.php`

**Changes**:
- ✅ Now extends `MultiKeyAIClientBase`
- ✅ Removed manual key management code
- ✅ Uses `acquireApiKey()` for automatic rotation
- ✅ Simplified from 195 lines to 177 lines
- ✅ Maintains full API compatibility

**Key Pattern**: `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_1`, `OPENROUTER_API_KEY_2`, ...

**Rate Limits** (per key):
- 20 requests/minute
- 1000 requests/day

### 2. DeepSeekClient

**File**: `app/Services/AI/DeepSeekClient.php`

**Changes**:
- ✅ Now extends `MultiKeyAIClientBase`
- ✅ Removed manual key management code
- ✅ Uses `acquireApiKey()` for automatic rotation
- ✅ Simplified from 188 lines to 170 lines
- ✅ Maintains full API compatibility

**Key Pattern**: `DEEPSEEK_API_KEY`, `DEEPSEEK_API_KEY_1`, `DEEPSEEK_API_KEY_2`, ...

**Rate Limits** (per key):
- 1000 requests/minute
- 100000 requests/day

### 3. UnifiedAIRouter

**File**: `app/Services/AI/UnifiedAIRouter.php`

**Changes**:
- ✅ Updated `getProvidersStatus()` to show multi-key information
- ✅ Now displays:
  - Key count
  - Rate limit multiplier
  - Effective rate limits
  - Aggregate usage statistics
- ✅ Fully backward compatible

### 4. InitializeApps Command

**File**: `app/Console/Commands/InitializeApps.php`

**Changes**:
- ✅ Enhanced AI provider display to show:
  - Number of keys configured
  - Rate limit multiplier
  - Effective rate limits
  - Aggregate usage across all keys

**Example Output**:
```
Verifying AI providers...
  ✅ openrouter: Available (text) (Priority: 1)
     Keys: 2 (Rate limit multiplier: 2x)
     Limits: 40 req/min, 2000 req/day
     Usage (all keys): 0 req/min, 0 req/day
  ❌ deepseek: Not configured (text) (Priority: 2)
  ✅ gemini: Available (multimodal) (Priority: 1)
```

---

## 🔧 How It Works

### Example: OpenRouter with 2 Keys

**Setup**:
```bash
# File: /www/programing/core_node/.secret_keys/.secret_ignore/OPENROUTER_API_KEY_1
sk-or-v1-abc123...

# File: /www/programing/core_node/.secret_keys/.secret_ignore/OPENROUTER_API_KEY_2
sk-or-v1-xyz789...
```

**Initialization**:
```php
$client = new OpenRouterClient();
// Auto-discovers 2 keys
// Effective limits: 40 req/min, 2000 req/day (2x base)
```

**Request Flow**:
```
User makes request
    ↓
Client calls acquireApiKey()
    ↓
Try Key 1 (sk-or-v1-abc123...)
    ├─ Rate limit OK? → Use Key 1 ✅
    └─ Rate limited? → Try Key 2
        ↓
    Try Key 2 (sk-or-v1-xyz789...)
        ├─ Rate limit OK? → Use Key 2 ✅
        └─ Rate limited? → Return error ❌
```

**Usage Tracking**:
```php
$stats = $client->getUsageStats();
// Returns:
[
    'aggregate' => [
        'minute' => ['requests' => 15, 'tokens' => 3000],
        'day' => ['requests' => 250, 'tokens' => 50000],
    ],
    'per_key' => [
        'key1_abc123456' => [...],
        'key2_xyz789012' => [...],
    ],
    'key_count' => 2,
    'effective_limits' => [
        'rpm' => 40,
        'rpd' => 2000,
    ],
]
```

---

## 📊 Rate Limit Examples

### OpenRouter (Base: 20 req/min, 1000 req/day)

| Keys | Effective req/min | Effective req/day |
|------|-------------------|-------------------|
| 1    | 20                | 1,000             |
| 2    | 40                | 2,000             |
| 3    | 60                | 3,000             |
| 4    | 80                | 4,000             |

### DeepSeek (Base: 1000 req/min, 100000 req/day)

| Keys | Effective req/min | Effective req/day |
|------|-------------------|-------------------|
| 1    | 1,000             | 100,000           |
| 2    | 2,000             | 200,000           |
| 3    | 3,000             | 300,000           |

---

## 🧪 Testing

### Verified Functionality

1. ✅ **Key Discovery**: System correctly finds all keys
   ```
   Found: OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2
   Keys: 2 (Rate limit multiplier: 2x)
   ```

2. ✅ **Rate Limit Calculation**: Correctly multiplies limits
   ```
   Base: 20 req/min × 2 keys = 40 req/min ✅
   Base: 1000 req/day × 2 keys = 2000 req/day ✅
   ```

3. ✅ **Display in sys:init**: Shows all information correctly
   ```bash
   $ php artisan sys:init

   Verifying AI providers...
     ✅ openrouter: Available (text) (Priority: 1)
        Keys: 2 (Rate limit multiplier: 2x)
        Limits: 40 req/min, 2000 req/day
        Usage (all keys): 0 req/min, 0 req/day
   ```

4. ✅ **API Compatibility**: All existing code continues to work
   - TranslationService ✅
   - AIServiceDispatcher ✅
   - UnifiedAIRouter ✅

---

## 🔑 Current Key Configuration

Based on actual files in `.secret_keys/.secret_ignore/`:

### OpenRouter ✅
- `OPENROUTER_API_KEY_1` ✅ (73 bytes)
- `OPENROUTER_API_KEY_2` ✅ (35 bytes)
- **Total**: 2 keys → **40 req/min, 2000 req/day**

### DeepSeek ❌
- No keys configured
- **Status**: Not available

### Google Gemini ✅
- `GOOGLE_API_KEY_2` ✅ (39 bytes)
- `GOOGLE_API_KEY_1` ❌ (missing)
- **Note**: Gemini already had multi-key support, unchanged

---

## 📦 Files Summary

### Created
```
✅ app/Services/AI/MultiKeyAIClientBase.php       (298 lines)
```

### Modified
```
✅ app/Services/AI/OpenRouterClient.php           (195 → 177 lines)
✅ app/Services/AI/DeepSeekClient.php             (188 → 170 lines)
✅ app/Services/AI/UnifiedAIRouter.php            (Updated getProvidersStatus)
✅ app/Console/Commands/InitializeApps.php        (Enhanced AI provider display)
```

### Documentation
```
✅ MULTI_KEY_AI_SYSTEM_REFACTORING.md             (this file)
```

---

## ✅ Backward Compatibility

All changes are **100% backward compatible**:

- ✅ Existing code using `new OpenRouterClient()` continues to work
- ✅ Existing code using `new DeepSeekClient()` continues to work
- ✅ Existing code using `UnifiedAIRouter` continues to work
- ✅ All method signatures remain unchanged
- ✅ Response formats remain unchanged

---

## 🚀 Usage Examples

### Example 1: Using OpenRouter Directly

```php
use App\Services\AI\OpenRouterClient;

$client = new OpenRouterClient();

// Check configuration
if ($client->hasApiKey()) {
    echo "Keys: " . $client->getKeyCount() . "\n";
    // Output: Keys: 2

    $limits = $client->getEffectiveRateLimits();
    echo "Effective limits: {$limits['rpm']} req/min\n";
    // Output: Effective limits: 40 req/min
}

// Make request (auto-rotation)
$result = $client->chat('Hello, world!');
if ($result['success']) {
    echo $result['text'];
    echo "\nUsed key: " . $result['key_identifier'];
}
```

### Example 2: Using UnifiedAIRouter

```php
use App\Services\AI\UnifiedAIRouter;

$router = new UnifiedAIRouter();

// Check all providers
$status = $router->getProvidersStatus();
foreach ($status as $provider => $info) {
    echo "{$provider}: ";
    echo $info['available'] ? 'Available' : 'Not configured';
    if (isset($info['key_count'])) {
        echo " ({$info['key_count']} keys, {$info['rate_limit_multiplier']}x limits)";
    }
    echo "\n";
}

// Make request (auto-routing and auto-rotation)
$result = $router->chat('Translate to French: Hello');
echo $result['text'];
echo "\nProvider: " . $result['provider'];
```

### Example 3: Checking Usage Statistics

```php
$client = new OpenRouterClient();
$stats = $client->getUsageStats();

echo "Aggregate usage:\n";
echo "  Minute: {$stats['aggregate']['minute']['requests']} requests\n";
echo "  Day: {$stats['aggregate']['day']['requests']} requests\n";

echo "\nPer-key usage:\n";
foreach ($stats['per_key'] as $keyId => $usage) {
    echo "  {$keyId}: {$usage['minute']['requests']} req/min\n";
}
```

---

## 🎓 Benefits

1. **Increased Throughput**: With 2 OpenRouter keys, get 40 req/min instead of 20
2. **Automatic Failover**: If one key hits rate limit, automatically use another
3. **Load Balancing**: Distribute requests across multiple keys
4. **Easy Scaling**: Just add more keys to increase capacity
5. **Transparent**: Existing code works without changes
6. **Monitoring**: Aggregate and per-key usage statistics

---

## 🔮 Future Enhancements

Potential improvements:
1. ✨ Add GeminiClient to use MultiKeyAIClientBase (currently has custom implementation)
2. ✨ Smart key selection based on current usage (use least-used key first)
3. ✨ Cost tracking per key
4. ✨ Key health monitoring (automatic disabling of failing keys)
5. ✨ Dynamic key addition/removal without restart

---

## 📝 Notes

- All rate limiting is per-key, not aggregate
- Keys are tried in order (Key 1, then Key 2, etc.)
- Only non-rate-limited keys are used
- System automatically handles all rotation logic
- No configuration needed beyond placing key files in `.secret_keys/.secret_ignore/`

---

**End of Refactoring Summary**
