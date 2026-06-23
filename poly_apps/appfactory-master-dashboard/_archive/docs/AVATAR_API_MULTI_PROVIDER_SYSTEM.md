# Laravel Avatar API - Multi-Provider System

## Overview

A unified avatar caching and delivery system supporting multiple avatar providers with smart caching, on-the-fly resizing, and provider selection capabilities.

## Architecture

### Core Components

```
app/Http/Common/
├── CommonAvatarService.php          # Unified service layer
└── AvatarProviders/
    ├── AvatarProviderInterface.php  # Provider interface
    ├── AbstractAvatarProvider.php   # Base implementation
    ├── AvatarProviderRegistry.php   # Provider management
    ├── PravatarProvider.php         # Real person photos
    ├── DicebearProvider.php         # Cartoon avatars (avataaars)
    ├── DicebearbotttsProvider.php   # Robot avatars
    ├── DicebearpixelProvider.php    # Pixel art avatars
    ├── UiavatarsProvider.php        # Initial-based avatars
    ├── RobohashProvider.php         # Robot/monster avatars
    └── GravatarProvider.php         # WordPress avatar service
```

### Design Patterns

- **Strategy Pattern**: Each provider implements `AvatarProviderInterface`
- **Registry Pattern**: `AvatarProviderRegistry` manages provider instances
- **Singleton Pattern**: Provider instances are cached
- **Template Method**: `AbstractAvatarProvider` provides common HTTP logic

## Supported Providers

| Index | Short Code | Provider Name | Max Size | Deterministic | Features |
|-------|------------|---------------|----------|---------------|----------|
| 0 | pravatar | Pravatar | 512px | No | Real person photos, random |
| 1 | dicebear | DiceBear (Avataaars) | 512px | Yes | Cartoon style, seed-based |
| 2 | uiavatars | UI Avatars | 512px | Yes | Initial letters with colors |
| 3 | robohash | RoboHash | 512px | Yes | Robots and monsters |
| 4 | gravatar | Gravatar | 2048px | Yes | WordPress ecosystem |
| 5 | dicebear-bottts | DiceBear (Bottts) | 512px | Yes | Robot style |
| 6 | dicebear-pixel | DiceBear (Pixel Art) | 512px | Yes | Retro 8-bit style |

**Deterministic**: Same seed always generates same avatar

## Caching Strategy

### Key Features

1. **Maximum Resolution Caching**: All avatars cached at 512x512 (or provider max)
2. **Keyword-Based**: Cache by username only, not by size
3. **Provider-Isolated**: Each provider caches separately
4. **On-the-Fly Resizing**: PHP GD library resizes from cache
5. **Size Clamping**: Out-of-range sizes automatically clamped to valid range
6. **Automatic Fallback**: Provider selection is treated as "preferred", with automatic fallback to other providers if the requested one fails

### Provider Fallback Strategy

The system implements a multi-tier fallback mechanism to ensure avatar availability:

**Priority Order:**
1. **Requested Provider Cache**: Check if specified provider has cached avatar
2. **Requested Provider API**: Try to fetch from specified provider's API
3. **Other Providers' Cache**: If request fails, check all other providers' caches
4. **Other Providers' API**: As last resort, try to fetch from other providers' APIs

**Key Behavior:**
- Provider parameter is treated as "preferred" rather than "required"
- If the preferred provider fails, system automatically tries alternatives
- Cached avatars from any provider are prioritized over new API calls
- System continues trying until a valid avatar is found or all providers fail

**Response Headers for Fallback:**
- `X-Requested-Provider`: The provider originally requested by user
- `X-Provider`: The provider that actually served the avatar
- `X-Fallback-Used: true`: Indicates fallback was triggered (only present when fallback occurred)

### Cache File Naming

```
avatar_{hash}_{seed}_{provider}.png
```

Example:
```
avatar_0285d564246ddd99f2da748c7541e7b2_testuser_dicebear.png
avatar_02f67f1cca660b6766c64e3a922fea9c_testuser_pravatar.png
avatar_a86a6353f4925d98ec267e31b7ca9961_testuser_robohash.png
```

### Cache Directory

Default: `/www/wwwroot/laravel_db/cache/avatars/`

Configured via `PathMapper::getLaravelCacheDir()`

## API Endpoints

### 1. Get Avatar

```http
GET /api/public/avatar/{name}?size={size}&provider={provider}
```

**Parameters:**
- `name` (required): Username or seed string
- `size` (optional): Desired size in pixels (1-512), default: 512
- `provider` (optional): Provider index (0-6) or short code, default: 'pravatar'

**Examples:**

```bash
# Default provider (pravatar), size 512x512
curl http://localhost:9000/api/public/avatar/alice

# Custom size
curl http://localhost:9000/api/public/avatar/alice?size=100

# Select provider by index
curl http://localhost:9000/api/public/avatar/alice?size=100&provider=1

# Select provider by short code
curl http://localhost:9000/api/public/avatar/alice?size=100&provider=dicebear

# Combined
curl http://localhost:9000/api/public/avatar/alice?size=200&provider=robohash
```

**Response Headers:**

```http
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=86400
X-From-Cache: true
X-Provider: dicebear
X-Requested-Provider: dicebear
X-Cached-Resolution: 512x512
X-Returned-Size: 100x100
```

**Size Clamping Headers (when size out of range):**

```http
X-Size-Clamped: true
X-Requested-Size: 1000x1000
X-Returned-Size: 512x512
```

**Fallback Headers (when provider fallback occurs):**

```http
X-Requested-Provider: pravatar
X-Provider: dicebear
X-Fallback-Used: true
X-From-Cache: true
```

This indicates that user requested `pravatar` but it failed or wasn't cached, so the system fell back to `dicebear` which had a cached avatar.

### 2. List All Providers

```http
GET /api/public/avatar-providers/list
```

**Response:**

```json
{
  "success": true,
  "providers": [
    {
      "short_code": "pravatar",
      "name": "Pravatar",
      "max_size": 512,
      "supports_size": true,
      "deterministic": false
    },
    {
      "short_code": "dicebear",
      "name": "DiceBear (Avataaars)",
      "max_size": 512,
      "supports_size": true,
      "deterministic": true
    }
  ],
  "default": "pravatar"
}
```

### 3. Get Cache Statistics

```http
GET /api/public/avatar-cache/stats
```

**Response:**

```json
{
  "cache_dir": "/www/wwwroot/laravel_db/cache/avatars",
  "total_files": 19,
  "total_size": 204440,
  "total_size_mb": 0.19
}
```

### 4. Clear Specific User Cache

```http
DELETE /api/public/avatar-cache/{name}?provider={provider}
```

**Parameters:**
- `name` (required): Username to clear
- `provider` (optional): Specific provider to clear, if not specified uses default

**Response:**

```json
{
  "success": true,
  "message": "Cache cleared"
}
```

### 5. Clear All Cache

```http
DELETE /api/public/avatar-cache
```

**Response:**

```json
{
  "success": true,
  "deleted_count": 19
}
```

## Usage Examples

### Frontend Integration (HTML)

```html
<!-- Default provider -->
<img src="http://localhost:9000/api/public/avatar/alice?size=100" alt="Alice">

<!-- DiceBear provider -->
<img src="http://localhost:9000/api/public/avatar/bob?size=150&provider=dicebear" alt="Bob">

<!-- RoboHash provider -->
<img src="http://localhost:9000/api/public/avatar/charlie?size=200&provider=3" alt="Charlie">
```

### JavaScript/React

```javascript
const AvatarComponent = ({ username, size = 100, provider = 'pravatar' }) => {
  const url = `http://localhost:9000/api/public/avatar/${username}?size=${size}&provider=${provider}`;
  return <img src={url} alt={username} />;
};

// Usage
<AvatarComponent username="alice" size={150} provider="dicebear" />
```

### Vue.js

```vue
<template>
  <img :src="avatarUrl" :alt="username" />
</template>

<script>
export default {
  props: {
    username: String,
    size: { type: Number, default: 100 },
    provider: { type: String, default: 'pravatar' }
  },
  computed: {
    avatarUrl() {
      return `http://localhost:9000/api/public/avatar/${this.username}?size=${this.size}&provider=${this.provider}`;
    }
  }
}
</script>
```

### Provider Selection Dropdown

```html
<select id="provider">
  <option value="0">Pravatar (Real Photos)</option>
  <option value="1">DiceBear (Cartoon)</option>
  <option value="2">UI Avatars (Initials)</option>
  <option value="3">RoboHash (Robots)</option>
  <option value="4">Gravatar</option>
  <option value="5">DiceBear Bottts (Robots)</option>
  <option value="6">DiceBear Pixel Art</option>
</select>

<script>
  const username = 'alice';
  const provider = document.getElementById('provider').value;
  const avatarUrl = `/api/public/avatar/${username}?size=150&provider=${provider}`;
</script>
```

## Adding New Providers

### Step 1: Create Provider Class

Create a new file in `app/Http/Common/AvatarProviders/`:

```php
<?php

namespace App\Http\Common\AvatarProviders;

class MyNewProvider extends AbstractAvatarProvider
{
    protected string $name = 'My New Provider';
    protected string $shortCode = 'mynew';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://api.example.com/avatar?seed=" . urlencode($seed) . "&size={$size}";
    }
}
```

### Step 2: Register Provider

Edit `app/Http/Common/AvatarProviders/AvatarProviderRegistry.php`:

```php
private static array $providers = [
    'pravatar' => PravatarProvider::class,
    'dicebear' => DicebearProvider::class,
    // ... existing providers
    'mynew' => MyNewProvider::class,  // Add new provider
];

private static array $indexMap = [
    0 => 'pravatar',
    1 => 'dicebear',
    // ... existing mappings
    7 => 'mynew',  // Add new index
];
```

### Step 3: Test

```bash
# Test new provider
curl http://localhost:9000/api/public/avatar/test?provider=mynew

# Or by index
curl http://localhost:9000/api/public/avatar/test?provider=7
```

## Performance Characteristics

### Cache Performance

- **First Request**: Fetches from external API, caches at 512x512
- **Subsequent Requests (same size)**: ~5ms (direct cache hit)
- **Subsequent Requests (different size)**: ~17ms (cache + resize)

### Response Times (from tests)

| Provider | First Request | Cached Request |
|----------|--------------|----------------|
| Pravatar | ~250ms | ~5ms |
| DiceBear | ~960ms | ~5ms |
| UI Avatars | ~374ms | ~5ms |
| RoboHash | ~1082ms | ~5ms |
| Gravatar | ~957ms | ~5ms |

### Storage Efficiency

Traditional approach (cache all sizes):
- 5 users × 3 providers × 5 sizes = **75 cache files**

New approach (cache max size, resize on demand):
- 5 users × 3 providers × 1 size = **15 cache files**
- **80% reduction** in cache files

## Error Handling

### Invalid Provider

```json
{
  "error": "Invalid provider"
}
```

### Network Failure

```json
{
  "success": true,
  "data": "...",
  "from_cache": false,
  "cache_failed": true,
  "provider": "pravatar"
}
```

Still returns avatar but logs cache write failure.

### Size Validation

Out-of-range sizes are automatically clamped:
- `size < 1` → clamped to 1
- `size > 512` → clamped to 512 (or provider max)

Headers indicate clamping occurred:
```
X-Size-Clamped: true
X-Requested-Size: 1000x1000
X-Returned-Size: 512x512
```

## Logging

All operations are logged with context:

```php
Log::info('[CommonAvatarService] Avatar fetched and cached', [
    'seed' => 'alice',
    'provider' => 'dicebear',
    'path' => '/cache/avatars/avatar_xxx_alice_dicebear.png',
    'size' => 45678,
    'resolution' => '512x512',
]);
```

Log categories:
- Cache hit/miss
- Provider selection
- Image resize operations
- Cache clearing
- Error conditions

## Security Considerations

1. **Seed Sanitization**: Seeds are sanitized for filesystem safety
2. **Size Validation**: Sizes are clamped to prevent resource exhaustion
3. **Provider Validation**: Invalid providers return error, not crash
4. **URL Encoding**: All external API parameters are properly encoded
5. **File Permissions**: Cache directory created with 0755 permissions

## Configuration

### Cache Directory

Edit `app/Providers/PathMapper.php` to change cache location:

```php
public static function getLaravelCacheDir(): string
{
    return '/your/custom/cache/path';
}
```

### Default Settings

In `app/Http/Common/CommonAvatarService.php`:

```php
private const CACHE_SUBDIR = 'avatars';        // Cache subdirectory
private const DEFAULT_SIZE = 512;              // Default size when not specified
private const MAX_CACHE_SIZE = 512;            // Maximum cache resolution
```

### Default Provider

In `app/Http/Common/AvatarProviders/AvatarProviderRegistry.php`:

```php
private const DEFAULT_PROVIDER = 'pravatar';  // Change default provider
```

## Maintenance

### Clear Old Cache

```bash
# Via API
curl -X DELETE http://localhost:9000/api/public/avatar-cache

# Via filesystem (older than 30 days)
find /www/wwwroot/laravel_db/cache/avatars -name "avatar_*.png" -mtime +30 -delete
```

### Monitor Cache Size

```bash
# Get statistics
curl http://localhost:9000/api/public/avatar-cache/stats

# Manual check
du -sh /www/wwwroot/laravel_db/cache/avatars
```

### Restart Service

```bash
curl -X POST http://localhost:9000/api/server-manager/restart
```

## Migration from Old System

If migrating from single-provider system:

1. Old cache files remain compatible (checked by name pattern)
2. New requests use new provider-specific naming
3. Old cache gradually replaced as users request new avatars
4. Manual cleanup: `DELETE /api/public/avatar-cache` to force refresh

## Testing

### Test Script

A comprehensive test script is available at:
`/www/programing/core_node/poly_apps/laravel_main/test_avatar_providers.php`

Run with:
```bash
php test_avatar_providers.php
```

### Manual Testing

```bash
# Test all providers
for i in {0..6}; do
  echo "Testing provider $i"
  curl -I "http://localhost:9000/api/public/avatar/test?provider=$i" 2>&1 | grep X-Provider
done

# Test size clamping
curl -I "http://localhost:9000/api/public/avatar/test?size=9999" 2>&1 | grep X-Size-Clamped

# Test cache hit
curl -I "http://localhost:9000/api/public/avatar/test" 2>&1 | grep X-From-Cache
curl -I "http://localhost:9000/api/public/avatar/test" 2>&1 | grep X-From-Cache
```

## Troubleshooting

### Issue: Avatar Not Loading

**Check:**
1. Service is running: `systemctl status laravel-octane`
2. Cache directory writable: `ls -ld /www/wwwroot/laravel_db/cache/avatars`
3. Network access to external APIs
4. Logs: `/www/wwwroot/laravel_db/logs/laravel.log`

### Issue: Wrong Avatar Returned

**Check:**
1. Provider parameter specified correctly
2. Cache may have old version: Clear cache for that user
3. Check provider is deterministic (pravatar is random)

### Issue: Slow Response

**Check:**
1. First request always slower (fetching from external API)
2. Subsequent requests should be ~5-17ms
3. Network issues with external provider
4. Large cache causing filesystem slowdown

### Issue: Cache Not Clearing

**Check:**
1. File permissions on cache directory
2. Provider parameter matches cache file
3. Check logs for permission errors

## References

### Provider Documentation

- **Pravatar**: https://pravatar.cc/
- **DiceBear**: https://www.dicebear.com/
- **UI Avatars**: https://ui-avatars.com/
- **RoboHash**: https://robohash.org/
- **Gravatar**: https://gravatar.com/

### Related Files

- Routes: `/www/programing/core_node/poly_apps/laravel_main/routes/api/public_api.php`
- Service: `/www/programing/core_node/poly_apps/laravel_main/app/Http/Common/CommonAvatarService.php`
- Providers: `/www/programing/core_node/poly_apps/laravel_main/app/Http/Common/AvatarProviders/`

## Changelog

### Version 2.0.0 (2026-01-05)

- Added multi-provider support (7 providers)
- Implemented provider registry and selection
- Provider-isolated caching
- Maintained backward compatibility

### Version 1.0.0 (Previous)

- Single provider (Pravatar only)
- Basic caching with size variants
