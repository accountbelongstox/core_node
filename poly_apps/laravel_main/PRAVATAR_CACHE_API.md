# Pravatar Cache API Documentation

## Overview
Provides cached avatar images from https://i.pravatar.cc with smart caching strategy.

## Features
- ✅ Fetches avatars from pravatar.cc API
- ✅ **Smart caching: Always caches at maximum resolution (512x512)**
- ✅ **Real-time resizing: PHP resizes cached images on-the-fly**
- ✅ **Keyword-based caching: Only username is cached, not size**
- ✅ Returns cached images on subsequent requests
- ✅ Automatic cache management
- ✅ Cache statistics

## Caching Strategy

### Key Principle
- **Cache by keyword**: Each username gets ONE cached file at 512x512
- **Resize on request**: Different sizes are generated in real-time from cached 512x512
- **No size-based caching**: Reduces disk usage and improves cache efficiency

### Example Flow
```
Request: /api/public/avatar/alice?size=50

1. Check cache for "alice" → Found 512x512 cached image
2. Resize 512x512 → 50x50 in memory (PHP GD)
3. Return resized 50x50 image
4. No new cache file created

Result: Only 1 file in cache (512x512), but supports all sizes 1-512
```

## Implementation

### Service Class
- **Location**: `app/Http/Common/CommonPravatarCache.php`
- **Cache Directory**: `storage/app/pravatar_cache` (via PathMapper)
- **Naming**: MD5 hash + sanitized name (e.g., `avatar_5d9c68c6_username.png`)
- **Max Cache Size**: 512x512 (configurable via `MAX_CACHE_SIZE` constant)
- **Default Size**: 512x512 (when no size parameter provided)

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
- `size` (optional): Avatar size in pixels (1-512, default: 512)

**Response Headers:**
- Content-Type: image/png
- Cache-Control: public, max-age=86400
- X-From-Cache: true/false (indicates if from cache)
- X-Cached-Resolution: 512x512 (always cached at max resolution)
- X-Returned-Size: {size}x{size} (actual returned size)

**Example:**
```bash
# Get full resolution (512x512)
curl http://localhost:9000/api/public/avatar/john -o avatar.png

# Get smaller size (resized from cached 512x512)
curl http://localhost:9000/api/public/avatar/jane?size=50 -o avatar_small.png

# Get medium size
curl http://localhost:9000/api/public/avatar/jane?size=200 -o avatar_medium.png
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
curl http://localhost:9000/api/public/avatar-cache/stats
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
curl -X DELETE http://localhost:9000/api/public/avatar-cache/john
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
curl -X DELETE http://localhost:9000/api/public/avatar-cache
```

## Usage in Code

### Get Avatar (Always Cached at 512x512)
```php
use App\Http\Common\CommonPravatarCache;

// Get avatar data (cached at 512x512)
$result = CommonPravatarCache::getAvatar('username');
if ($result['success']) {
    $imageData = $result['data']; // 512x512 PNG
    $fromCache = $result['from_cache'];
    $path = $result['path'];
}

// Get avatar as HTTP response (with optional resizing)
return CommonPravatarCache::getAvatarResponse('username', 100); // Resizes to 100x100
return CommonPravatarCache::getAvatarResponse('username', null); // Returns 512x512
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

1. **First Request** (any size):
   - Generates filename: `avatar_[md5]_[sanitized_name].png`
   - Fetches from `https://i.pravatar.cc/150?u={name}&size=512` (always 512x512)
   - Saves to `storage/app/pravatar_cache/`
   - Returns image with `X-From-Cache: false`

2. **Subsequent Requests** (same keyword, different size):
   - Checks cache file exists (512x512)
   - Reads cached 512x512 image
   - Resizes in memory using PHP GD (if size ≠ 512)
   - Returns resized image with `X-From-Cache: true`

3. **Cache Storage**:
   - Uses Laravel storage path (via PathMapper)
   - Automatic directory creation
   - Permissions: 0755
   - File format: PNG
   - **Only ONE file per username** (always 512x512)

4. **Image Resizing**:
   - Uses PHP GD library (`imagecopyresampled`)
   - High-quality bicubic interpolation
   - Preserves transparency
   - Maximum compression (PNG level 9)
   - Real-time processing (no disk I/O for resized versions)

## Performance Benefits

### Disk Usage
- **Old approach**: 3 sizes × 100 users = 300 cache files
- **New approach**: 1 size × 100 users = 100 cache files
- **Savings**: 66% reduction in cache files

### Cache Efficiency
- **Hit rate**: Higher (all sizes share same cache key)
- **Storage**: Lower (only max resolution cached)
- **Flexibility**: Any size 1-512 supported without pre-caching

### Response Time
- **First request**: ~2-3s (download from pravatar.cc)
- **Cached 512x512**: <50ms (direct file read)
- **Cached + resize to 50x50**: ~100ms (file read + GD resize)
- **Cached + resize to 200x200**: ~150ms (file read + GD resize)

## Testing

Run the test script:
```bash
php test_avatar_resize.php
```

Test results show:
- ✅ First fetch caches at 512x512
- ✅ Subsequent requests use cache
- ✅ Different sizes are resized correctly
- ✅ Only 1 file in cache per user
- ✅ Invalid sizes return proper errors
- ✅ Response headers show cache/resize info

## File Structure

```
app/Http/Common/
  └── CommonPravatarCache.php    # Service class with resize logic

routes/
  └── api/
      └── public_api.php          # API routes

storage/
  └── app/
      └── pravatar_cache/         # Cache storage
          └── avatar_*.png        # Cached avatars (512x512 only)

test_avatar_resize.php            # Test script
```

## Technical Details

### Image Processing
- **Library**: PHP GD (imagecreatefromstring, imagecopyresampled)
- **Quality**: High (bicubic interpolation)
- **Format**: PNG with alpha transparency
- **Compression**: Level 9 (maximum)

### Size Validation
- **Minimum**: 1px
- **Maximum**: 512px
- **Invalid sizes**: Return 400 error with message

### Error Handling
- Invalid size → 400 Bad Request
- Download failure → 500 Internal Server Error
- Resize failure → Falls back to original 512x512
- All errors logged to Laravel log

## Notes

- Cache files are named with MD5 hash for consistency
- Original name is included (truncated to 50 chars) for readability
- Network timeout: 10 seconds
- Cache never expires (manual clearing only)
- All API endpoints are public (no authentication required)
- **GD library required** (enabled by default in most PHP installations)
