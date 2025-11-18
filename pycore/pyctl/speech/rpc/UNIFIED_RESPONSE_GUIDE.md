# Unified Response Wrapper Guide

## Overview

The RPC Manager now provides a unified response wrapper system to standardize all API responses across the platform.

## Response Format

All API responses follow this standard structure:

```json
{
  "success": true,
  "data": { /* actual response data */ },
  "error": null,
  "message": "Optional success message",
  "timestamp": 1234567890.123,
  /* ...additional custom fields */
}
```

### Success Response
```json
{
  "success": true,
  "data": {
    "audio_base64": "...",
    "language": "en-US"
  },
  "timestamp": 1234567890.123
}
```

### Error Response
```json
{
  "success": false,
  "error": "Text is required",
  "timestamp": 1234567890.123
}
```

## Usage in RPC Handlers

### Method 1: Using `create_response()`

```python
def _handle_example(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
    """Example handler"""

    # Get parameters
    value = params.get('value')

    # Validate
    if not value:
        return self.create_error('Value is required')

    # Process
    try:
        result = process_value(value)
        return self.create_response(
            success=True,
            data={'result': result},
            message='Processing completed'
        )
    except Exception as e:
        return self.create_error(str(e))
```

### Method 2: Using Shorthand Methods

```python
def _handle_example(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
    """Example handler with shorthand methods"""

    value = params.get('value')
    if not value:
        return self.create_error('Value is required')

    try:
        result = process_value(value)
        return self.create_success(
            data={'result': result},
            message='Processing completed'
        )
    except Exception as e:
        return self.create_error(str(e))
```

### Method 3: With Additional Fields

```python
def _handle_example(self, params: Dict, request_id: str, context: Dict) -> Dict[str, Any]:
    """Example with custom fields"""

    result = process_value(params['value'])

    return self.create_success(
        data={'result': result},
        message='Processing completed',
        # Additional custom fields
        processing_time=0.123,
        cache_hit=True,
        server_version='1.0.0'
    )
```

## Response Wrapper Methods

### `create_response(success, data, error, message, **kwargs)`

Main method for creating responses.

**Arguments:**
- `success` (bool): Whether operation succeeded
- `data` (any): Response data (automatically sanitized for JSON)
- `error` (str): Error message (sets success=False automatically)
- `message` (str): Optional success/info message
- `**kwargs`: Additional custom fields

**Returns:** Dict with standardized structure

### `create_error(error, **kwargs)`

Shorthand for creating error responses.

**Arguments:**
- `error` (str): Error message
- `**kwargs`: Additional custom fields

**Returns:** Error response dict

### `create_success(data, message, **kwargs)`

Shorthand for creating success responses.

**Arguments:**
- `data` (any): Response data
- `message` (str): Optional success message
- `**kwargs`: Additional custom fields

**Returns:** Success response dict

## Automatic JSON Sanitization

The wrapper automatically handles:
- **DateTime objects** → Unix timestamps
- **Nested dictionaries** → Recursively sanitized
- **Lists** → All items sanitized
- **Custom objects** → Preserved as-is

```python
# DateTime is automatically converted
return self.create_success(
    data={
        'created_at': datetime.now(),  # → timestamp
        'items': [
            {'timestamp': datetime.utcnow()}  # → timestamp
        ]
    }
)

# Output:
# {
#   "success": true,
#   "data": {
#     "created_at": 1234567890.123,
#     "items": [{"timestamp": 1234567890.456}]
#   },
#   "timestamp": 1234567890.789
# }
```

## Web Interface Integration

The web interface automatically handles both old and new response formats via `unwrapResponse()`:

```javascript
// Automatic unwrapping
const result = await apiCall('tts', {text: 'hello', language: 'en-US'});

// New format: { success: true, data: {audio_base64: '...'} }
// → Unwrapped: { success: true, audio_base64: '...', data: {...} }

// Old format: { success: true, audio_base64: '...' }
// → Returns as-is: { success: true, audio_base64: '...' }

// Access data the same way regardless of format
if (result.success) {
    console.log(result.audio_base64);  // Works for both formats
}
```

## Migration Guide

### Before (Old Format)
```python
def _handle_tts(self, params, request_id, context):
    if not params.get('text'):
        return {
            'success': False,
            'error': 'Text is required'
        }

    audio = synthesize(params['text'])
    return {
        'success': True,
        'audio_base64': audio,
        'language': params['language']
    }
```

### After (Unified Format)
```python
def _handle_tts(self, params, request_id, context):
    if not params.get('text'):
        return self.create_error('Text is required')

    audio = synthesize(params['text'])
    return self.create_success(data={
        'audio_base64': audio,
        'language': params['language']
    })
```

## Benefits

1. **Consistency**: All endpoints return the same structure
2. **Type Safety**: Automatic JSON serialization of datetime/custom types
3. **Error Handling**: Standardized error format
4. **Extensibility**: Easy to add metadata (timestamps, versions, etc.)
5. **Backward Compatible**: Works with existing web interface
6. **Documentation**: Self-documenting with consistent structure

## Examples

### Example 1: Simple Success
```python
return self.create_success(data={'count': 10})
# → {"success": true, "data": {"count": 10}, "timestamp": 123.45}
```

### Example 2: Error with Details
```python
return self.create_error('File not found', file_path='/tmp/test.txt', code=404)
# → {"success": false, "error": "File not found", "file_path": "/tmp/test.txt", "code": 404, "timestamp": 123.45}
```

### Example 3: Success with Message
```python
return self.create_success(
    data={'items': [1, 2, 3]},
    message='Retrieved 3 items',
    total_count=3
)
# → {
#   "success": true,
#   "data": {"items": [1, 2, 3]},
#   "message": "Retrieved 3 items",
#   "total_count": 3,
#   "timestamp": 123.45
# }
```

### Example 4: Complex Data with DateTime
```python
return self.create_success(data={
    'user': {
        'name': 'John',
        'created_at': datetime(2024, 1, 1, 12, 0, 0)
    },
    'items': [
        {'id': 1, 'timestamp': datetime.now()},
        {'id': 2, 'timestamp': datetime.now()}
    ]
})
# → All datetime objects automatically converted to timestamps
```

## Best Practices

1. **Always use wrapper methods** for new handlers
2. **Use `create_error()` for validation errors** at the start of handlers
3. **Use `create_success()` for successful operations**
4. **Add custom fields** via kwargs for metadata (processing_time, cache_hit, etc.)
5. **Let the wrapper handle serialization** - don't manually convert datetime
6. **Keep error messages user-friendly** and actionable
7. **Use message field** for success notifications (e.g., "Conversion completed")

## Testing

```python
# Test error response
response = handler._handle_example({'value': None}, 'req_1', {})
assert response['success'] == False
assert 'error' in response
assert 'timestamp' in response

# Test success response
response = handler._handle_example({'value': 'test'}, 'req_2', {})
assert response['success'] == True
assert 'data' in response
assert response['data']['result'] == 'processed'
assert 'timestamp' in response
```
