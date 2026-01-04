# Pravatar Cache API Documentation

## Overview
Provides cached avatar images from https://i.pravatar.cc with file system caching.

## Features
- ✅ Fetches avatars from pravatar.cc API
- ✅ Caches avatars in Laravel storage using file system map
- ✅ Returns cached images on subsequent requests
- ✅ Automatic cache management
- ✅ Cache statistics

## Implementation

### Service Class
- **Location**: `app/Http/Common/CommonPravatarCache.php`
- **Cache Directory**: `storage/app/pravatar_cache`
- **Naming**: MD5 hash + sanitized name (e.g., `avatar_5d9c68c6_username.png`)

### Routes
- **File**: `routes/api/public_api.php`
- **Registration**: Included in `routes/api.php`

## API Endpoints

### 1. Get Avatar
```
GET /api/public/avatar/{name}
GET /api/public/avatar/{name}?size={size}
```

**Parameters:**
- `name` (required): User identifier (username, email, etc.)
- `size` (optional): Avatar size in pixels (default: 150)

**Response:**
- Content-Type: image/png
- Cache-Control: public, max-age=86400
- X-From-Cache: true/false

**Example:**
```bash
curl http://localhost:8000/api/public/avatar/john -o avatar.png
curl http://localhost:8000/api/public/avatar/jane?size=200 -o avatar.png
```

### 2. Get Cache Statistics
```
GET /api/public/avatar-cache/stats
```

**Response:**
```json
{
  "cache_dir": "/path/to/storage/app/pravatar_cache",
  "total_files": 10,
  "total_size": 56789,
  "total_size_mb": 0.05
}
```

**Example:**
```bash
curl http://localhost:8000/api/public/avatar-cache/stats
```

### 3. Clear Specific User Cache
```
DELETE /api/public/avatar-cache/{name}
```

**Parameters:**
- `name` (required): User identifier to clear

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/public/avatar-cache/john
```

### 4. Clear All Cache
```
DELETE /api/public/avatar-cache
```

**Response:**
```json
{
  "success": true,
  "deleted_count": 10
}
```

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/public/avatar-cache
```

## Usage in Code

### Get Avatar
```php
use App\Http\Common\CommonPravatarCache;

// Get avatar data
$result = CommonPravatarCache::getAvatar('username');
if ($result['success']) {
    $imageData = $result['data'];
    $fromCache = $result['from_cache'];
    $path = $result['path'];
}

// Get avatar as HTTP response
return CommonPravatarCache::getAvatarResponse('username', 150);
```

### Get Cache Stats
```php
$stats = CommonPravatarCache::getCacheStats();
// Returns: ['cache_dir', 'total_files', 'total_size', 'total_size_mb']
```

### Clear Cache
```php
// Clear specific user
$cleared = CommonPravatarCache::clearCache('username');

// Clear all
$result = CommonPravatarCache::clearAllCache();
```

## Cache Mechanism

1. **First Request**:
   - Generates filename: `avatar_[md5]_[sanitized_name].png`
   - Fetches from `https://i.pravatar.cc/150?u={name}&size={size}`
   - Saves to `storage/app/pravatar_cache/`
   - Returns image with `X-From-Cache: false`

2. **Subsequent Requests**:
   - Checks cache file exists
   - Reads from file system
   - Returns image with `X-From-Cache: true`

3. **Cache Storage**:
   - Uses Laravel storage path
   - Automatic directory creation
   - Permissions: 0755
   - File format: PNG

## Testing

Run the test script:
```bash
php test_pravatar_cache.php
```

Test results show:
- ✅ Cache directory creation
- ✅ First fetch from API
- ✅ Second fetch from cache
- ✅ Cache statistics
- ✅ Cache clearing
- ✅ Cache verification

## File Structure

```
app/Http/Common/
  └── CommonPravatarCache.php    # Service class

routes/
  └── api/
      └── public_api.php          # API routes

storage/
  └── app/
      └── pravatar_cache/         # Cache storage
          └── avatar_*.png        # Cached avatars

test_pravatar_cache.php           # Test script
```

## Notes

- Cache files are named with MD5 hash for consistency
- Original name is included (truncated to 50 chars) for readability
- Network timeout: 10 seconds
- Cache never expires (manual clearing only)
- All API endpoints are public (no authentication required)
