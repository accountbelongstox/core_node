# BankV1 API Bridge Documentation

## Overview

This document describes the API endpoints that the Flutter Bank App requires from the Laravel backend. The backend must implement these endpoints to support the app's data submission functionality.

## Base URL Configuration

The app supports multiple API endpoints with automatic failover:
- `http://192.168.50.3:9000/` (Priority 1 - Local Development)
- `https://api.si.gm15.com` (Priority 2 - Production Server 1)
- `https://api.si.12gm.com/` (Priority 3 - Production Server 2)

The app will automatically detect and use the first available endpoint.

## API Endpoints

### 0. Health Check Endpoint (For Endpoint Auto-Detection)

**Endpoint:** `GET /` or `GET /api/health`

**Description:** Used by the app's multi-URL switching system to detect available endpoints. The app will test this endpoint to determine which server is available.

**Authentication:** None required

**Request:** Simple GET request

**Response Format:**

**Success Response (200-499):**
Any HTTP status code from 200 to 499 is considered "healthy" (endpoint is reachable).

**Failure Response (500+ or timeout):**
HTTP status code 500+ or connection timeout indicates the endpoint is unavailable.

**Note:** The app uses a 1-second timeout for health checks. The endpoint should respond quickly.

---

### 1. Data Submission Endpoint

**Endpoint:** `POST /api/bank/data/submit`

**Description:** Receives comprehensive device, registration, and user data from the Flutter app. This endpoint is called automatically when:
- User logs in successfully
- User saves data modifications in the data management center

**Authentication:** None required (public endpoint)

**Request Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Request Body:**

```json
{
  "device_info": {
    "device_name": "string",
    "device_id": "string",
    "app_signature": "string",
    "machine_code": "string",
    "platform": "string",
    "platform_version": "string",
    "ip_address": "string|null",
    "additional_info": {
      "locale": "string",
      "number_of_processors": "integer"
    }
  },
  "registration_info": {
    "registration_code": "string|null",
    "is_registered": "boolean",
    "is_super_user": "boolean",
    "registration_time": "string|null (ISO8601)",
    "expiration_time": "string|null (ISO8601)"
  },
  "user_data": {
    "phone": "string|null",
    "full_name": "string|null",
    "location": "string|null",
    "city": "string|null",
    "total_balance": "float|null",
    "cards": [
      {
        "card_number": "string",
        "card_type": "string",
        "balance": "float",
        "currency": "string",
        "opened_at": "string|null (ISO8601)"
      }
    ],
    "additional_data": {
      "user_id": "string|null",
      "username": "string|null",
      "email": "string|null",
      "role_level": "integer|null",
      "role_name": "string|null",
      "global_balance": "float|null",
      "holdings_total": "float|null"
    }
  },
  "submit_time": "string (ISO8601)"
}
```

**Field Descriptions:**

#### device_info
- `device_name`: Device name (e.g., "Windows Device", "Android Device", "iOS Device")
- `device_id`: Unique device identifier (persistent across app reinstalls)
- `app_signature`: Application signature for security verification
- `machine_code`: Machine-specific code (16-character uppercase hex string)
- `platform`: Platform type (`web`, `android`, `ios`, `windows`, `macos`, `linux`, `unknown`)
- `platform_version`: Operating system version
- `ip_address`: Local IP address (IPv4, nullable)
- `additional_info`: Additional device information
  - `locale`: System locale (e.g., "en_US", "zh_CN")
  - `number_of_processors`: Number of CPU cores

#### registration_info
- `registration_code`: Registration/license code (nullable)
- `is_registered`: Whether device is registered
- `is_super_user`: Whether user has super user privileges
- `registration_time`: Registration timestamp (ISO8601, nullable)
- `expiration_time`: License expiration timestamp (ISO8601, nullable)

#### user_data
- `phone`: User phone number (nullable)
- `full_name`: User full name (may be masked, e.g., "*1234")
- `location`: User location/province (nullable)
- `city`: User city (nullable)
- `total_balance`: Total account balance (nullable)
- `cards`: Array of bank card objects
  - `card_number`: Bank card number
  - `card_type`: Card type (e.g., "储蓄卡", "信用卡")
  - `balance`: Card balance
  - `currency`: Currency code (default: "CNY")
  - `opened_at`: Card opening date (ISO8601, nullable)
- `additional_data`: Additional user information (nullable)
  - `user_id`: User ID
  - `username`: Username
  - `email`: Email address
  - `role_level`: User role level
  - `role_name`: User role name
  - `global_balance`: Global balance
  - `holdings_total`: Total holdings value

#### submit_time
- ISO8601 formatted timestamp of when the data was submitted

**Response Format:**

**Success Response (200 OK):**
```json
{
  "status": "success",
  "message": "Data submitted successfully",
  "data": {
    "submission_id": "string",
    "received_at": "string (ISO8601)"
  }
}
```

**Error Response (400/500):**
```json
{
  "status": "error",
  "message": "Error message",
  "error": "Detailed error description"
}
```

**Example Request:**
```json
{
  "device_info": {
    "device_name": "Windows Device",
    "device_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "app_signature": "signature_hash_here",
    "machine_code": "ABCD1234EFGH5678",
    "platform": "windows",
    "platform_version": "10.0.19045",
    "ip_address": "192.168.1.100",
    "additional_info": {
      "locale": "zh_CN",
      "number_of_processors": 8
    }
  },
  "registration_info": {
    "registration_code": "XXXX-XXXX-XXXX-XXXX",
    "is_registered": true,
    "is_super_user": false,
    "registration_time": null,
    "expiration_time": "2026-12-31T23:59:59Z"
  },
  "user_data": {
    "phone": "13800138000",
    "full_name": "*8000",
    "location": "北京市",
    "city": "北京市",
    "total_balance": 125000.50,
    "cards": [
      {
        "card_number": "6222021234567890123",
        "card_type": "储蓄卡",
        "balance": 100000.00,
        "currency": "CNY",
        "opened_at": "2024-01-15T10:30:00Z"
      },
      {
        "card_number": "6222029876543210987",
        "card_type": "信用卡",
        "balance": 25000.50,
        "currency": "CNY",
        "opened_at": "2024-03-20T14:20:00Z"
      }
    ],
    "additional_data": {
      "user_id": "user_123",
      "username": "13800138000",
      "email": "user@example.com",
      "role_level": 1,
      "role_name": "普通用户",
      "global_balance": 125000.50,
      "holdings_total": 50000.00
    }
  },
  "submit_time": "2026-01-26T10:30:45.123Z"
}
```

**Example Response:**
```json
{
  "status": "success",
  "message": "Data submitted successfully",
  "data": {
    "submission_id": "sub_20260126103045123",
    "received_at": "2026-01-26T10:30:45.456Z"
  }
}
```

## Error Tolerance and Data Validation

### Frontend Error Tolerance

The Flutter app implements comprehensive error tolerance to ensure data submission succeeds even when some data cannot be collected. The following describes how the app handles failures:

#### Device Information Collection
- **Device ID**: If collection fails, defaults to `"unknown"`
- **App Signature**: If collection fails, defaults to `"unknown"`
- **Machine Code**: If collection fails, defaults to `"unknown"`
- **Device Name**: If collection fails, defaults to `"Unknown Device"`
- **Platform**: If detection fails, defaults to `"unknown"`
- **Platform Version**: If collection fails, defaults to `"unknown"`
- **IP Address**: If collection fails, sent as `null` (optional field)
- **Additional Info**: Individual fields may be missing if collection fails

#### Registration Information Collection
- **Registration Code**: If unavailable, sent as `null`
- **Is Registered**: If unavailable, defaults to `false`
- **Is Super User**: If unavailable, defaults to `false`
- **Registration Time**: Always sent as `null` (not collected)
- **Expiration Time**: If unavailable, sent as `null`

#### User Data Collection
- **Phone**: If unavailable, sent as `null`
- **Full Name**: If unavailable, sent as `null`
- **Location**: If unavailable, sent as `null`
- **City**: If unavailable, sent as `null`
- **Total Balance**: If unavailable, sent as `null`
- **Cards Array**: If collection fails, sent as empty array `[]`
- **Additional Data**: Individual fields may be missing if collection fails
  - Each field (user_id, username, email, etc.) is collected independently
  - If one field fails, others continue to be collected
  - If all fields fail, `additional_data` is sent as `null`

#### Card Data Collection
- Each card is processed independently
- If one card fails to process, other cards continue to be collected
- Card fields are required (non-nullable in model), but processing errors are caught per card

### Backend Error Tolerance Requirements

The backend **MUST** handle the following scenarios gracefully:

#### 1. Missing or Null Fields
- All nullable fields (marked with `|null` in documentation) may be `null`
- The backend should accept `null` values without error
- Store `null` values in the database as `NULL` (not empty strings)

#### 2. Default Values
- When frontend sends default values (e.g., `"unknown"`, `"Unknown Device"`), treat them as valid data
- Do not reject submissions because of default values
- Log default values for monitoring but do not fail the request

#### 3. Empty Arrays
- `cards` array may be empty `[]`
- `additional_info` object may be empty `{}`
- Process empty collections normally (no cards = no card records to insert)

#### 4. Partial Data
- Accept submissions even if entire sections are missing or minimal
- Example: Device info with only `device_id` and `platform` should still be accepted
- Example: User data with only `phone` should still be accepted

#### 5. Data Type Validation
- Validate data types but be lenient with conversions
- Example: Accept `"123.45"` (string) for `total_balance` and convert to float
- Example: Accept `"true"` (string) for boolean fields and convert appropriately

#### 6. Required vs Optional Fields

**Always Required (reject if missing):**
- `device_info.device_id` (but accept `"unknown"` as valid)
- `device_info.platform` (but accept `"unknown"` as valid)
- `registration_info.is_registered` (boolean, always present)
- `registration_info.is_super_user` (boolean, always present)
- `submit_time` (ISO8601 timestamp, always present)

**Optional Fields (accept null or missing):**
- All fields in `device_info` except `device_id` and `platform`
- All fields in `registration_info` except boolean flags
- All fields in `user_data` (entire section can be minimal)
- All fields in `additional_data` within `user_data`

#### 7. Error Handling Strategy

**Backend should:**
1. **Accept and store** all valid data, even if incomplete
2. **Log warnings** for missing expected data (for monitoring)
3. **Never reject** a submission due to missing optional fields
4. **Use database defaults** for nullable fields
5. **Continue processing** even if some nested data fails (e.g., one card fails, process others)

**Backend should NOT:**
1. Reject submissions because optional fields are null
2. Require fields that are marked as nullable in the documentation
3. Fail the entire request if one card in the array is invalid
4. Require `additional_data` to be present or complete

### Example: Minimal Valid Request

The backend should accept this minimal request:

```json
{
  "device_info": {
    "device_id": "unknown",
    "platform": "unknown"
  },
  "registration_info": {
    "is_registered": false,
    "is_super_user": false
  },
  "user_data": {
    "cards": []
  },
  "submit_time": "2026-01-26T10:30:45Z"
}
```

### Example: Partial Failure Scenario

If device info collection partially fails, the app will send:

```json
{
  "device_info": {
    "device_name": "Unknown Device",
    "device_id": "abc123",
    "app_signature": "unknown",
    "machine_code": "unknown",
    "platform": "windows",
    "platform_version": "unknown",
    "ip_address": null,
    "additional_info": {}
  },
  ...
}
```

The backend should accept this and store what is available.

### Validation Rules Summary

| Field | Required | Can be Default Value | Can be Null |
|-------|----------|---------------------|-------------|
| device_info.device_id | Yes | Yes ("unknown") | No |
| device_info.platform | Yes | Yes ("unknown") | No |
| device_info.device_name | No | Yes ("Unknown Device") | No |
| device_info.ip_address | No | No | Yes |
| registration_info.is_registered | Yes | No | No |
| registration_info.registration_code | No | No | Yes |
| user_data.phone | No | No | Yes |
| user_data.cards | No | No | No (but can be []) |
| submit_time | Yes | No | No |

## Implementation Requirements

### Database Schema Recommendations

The backend should store the submitted data in appropriate database tables:

1. **device_submissions** table:
   - `id` (primary key)
   - `device_id` (indexed)
   - `device_name`
   - `machine_code` (indexed)
   - `platform`
   - `platform_version`
   - `ip_address`
   - `app_signature`
   - `additional_info` (JSON)
   - `created_at`
   - `updated_at`

2. **registration_submissions** table:
   - `id` (primary key)
   - `device_id` (foreign key to device_submissions)
   - `registration_code` (indexed)
   - `is_registered`
   - `is_super_user`
   - `registration_time`
   - `expiration_time`
   - `created_at`
   - `updated_at`

3. **user_data_submissions** table:
   - `id` (primary key)
   - `device_id` (foreign key to device_submissions)
   - `phone` (indexed)
   - `full_name`
   - `location`
   - `city`
   - `total_balance`
   - `user_id`
   - `username`
   - `email`
   - `additional_data` (JSON)
   - `submit_time`
   - `created_at`
   - `updated_at`

4. **bank_card_submissions** table:
   - `id` (primary key)
   - `user_data_submission_id` (foreign key to user_data_submissions)
   - `card_number` (indexed, encrypted)
   - `card_type`
   - `balance`
   - `currency`
   - `opened_at`
   - `created_at`
   - `updated_at`

### Security Considerations

1. **Data Encryption**: Sensitive data like card numbers should be encrypted at rest
2. **IP Validation**: Validate and log IP addresses for security auditing
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Data Validation**: Validate all input data before storing (but be tolerant of missing optional fields)
5. **Logging**: Log all submissions for audit purposes, including warnings for missing expected data

### Error Tolerance Implementation

When implementing the endpoint, follow these error tolerance guidelines:

1. **Use nullable database columns** for all optional fields
2. **Set default values** in database schema where appropriate
3. **Catch and log** individual field processing errors without failing the entire request
4. **Process arrays incrementally** - if one card fails, continue with others
5. **Return success** even if some data couldn't be stored (log warnings instead)
6. **Validate structure** but not completeness - accept partial data

### Error Handling

The endpoint should handle the following error cases:

**Client Errors (400):**
- Invalid JSON format
- Missing critical required fields (device_id, platform, is_registered, submit_time)
- Invalid data types that cannot be converted

**Server Errors (500):**
- Database connection errors
- Critical server errors

**Important Notes:**
- **DO NOT** return 400 for missing optional/nullable fields
- **DO NOT** return 400 for default values like "unknown" or "Unknown Device"
- **DO NOT** return 400 for empty arrays or null values in optional fields
- **DO** log warnings for missing expected data but still return 200 success
- **DO** attempt to store whatever data is available, even if incomplete

**Error Response Format:**
```json
{
  "status": "error",
  "message": "Error message",
  "error": "Detailed error description",
  "failed_fields": ["field1", "field2"]  // Optional: list fields that failed
}
```

**Partial Success Handling:**
If some data is stored successfully but other parts fail, consider returning:
```json
{
  "status": "partial_success",
  "message": "Data submitted with warnings",
  "data": {
    "submission_id": "sub_123",
    "warnings": [
      "Failed to store card data for card #2",
      "IP address could not be validated"
    ]
  }
}
```

All errors should return a consistent JSON format with appropriate HTTP status codes.

## Testing

### Test Cases

1. **Valid Submission**: Submit complete data with all fields
2. **Partial Data**: Submit data with nullable fields as null
3. **Invalid Format**: Submit malformed JSON
4. **Missing Fields**: Submit data with missing required fields
5. **Large Payload**: Test with maximum expected data size
6. **Concurrent Requests**: Test multiple simultaneous submissions

### Sample cURL Command

```bash
curl -X POST http://192.168.50.3:9000/api/bank/data/submit \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "device_info": {
      "device_name": "Test Device",
      "device_id": "test_device_123",
      "app_signature": "test_signature",
      "machine_code": "TEST1234CODE5678",
      "platform": "windows",
      "platform_version": "10.0",
      "ip_address": "192.168.1.1",
      "additional_info": {
        "locale": "en_US",
        "number_of_processors": 4
      }
    },
    "registration_info": {
      "is_registered": true,
      "is_super_user": false
    },
    "user_data": {
      "phone": "13800138000",
      "total_balance": 1000.00,
      "cards": []
    },
    "submit_time": "2026-01-26T10:30:45Z"
  }'
```

## Notes

- The app submits data silently in the background - no user-visible network status is shown
- The endpoint should be idempotent - multiple submissions from the same device should be handled gracefully
- Consider implementing data deduplication based on device_id and submit_time
- The endpoint should respond quickly (< 2 seconds) to avoid blocking the app
- All timestamps are in ISO8601 format with timezone information
