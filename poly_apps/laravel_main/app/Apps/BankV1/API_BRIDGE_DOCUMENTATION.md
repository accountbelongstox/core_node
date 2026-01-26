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
      "number_of_processors": "integer",
      "operating_system": "string",
      "operating_system_version": "string",
      "environment": "string",
      "resolved_executable": "string",
      "package_config": "string|null"
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
    },
    "complete_user_profile": {
      "id": "string|null",
      "name": "string|null",
      "nickname": "string|null",
      "username": "string|null",
      "email": "string|null",
      "phone": "string|null",
      "full_name": "string|null",
      "avatar": "string|null",
      "about": "string|null",
      "age": "integer|null",
      "gender": "string|null",
      "birthday": "string|null",
      "date_of_birth": "string|null (ISO8601)",
      "city": "string|null",
      "location": "string|null",
      "education": "string|null",
      "occupation": "string|null",
      "language": "string|null",
      "account_status": "string|null",
      "account_number": "string|null",
      "account_type": "string|null",
      "balance": "float|null",
      "currency": "string|null",
      "card_count": "integer|null",
      "points": "integer|null",
      "coupons": "integer|null",
      "credit_card_level": "string|null",
      "last_login_at": "string|null (ISO8601)",
      "login_attempts": "integer|null",
      "street": "string|null",
      "state": "string|null",
      "zip_code": "string|null",
      "country": "string|null",
      "created_at": "string|null (ISO8601)",
      "updated_at": "string|null (ISO8601)"
    },
    "global_app_data": {
      "last_active_time": "string (ISO8601)",
      "session_count": "integer",
      "app_version": "string",
      "location": "string|null",
      "city": "string|null",
      "balance": "float|null",
      "username": "string|null",
      "full_name": "string|null",
      "points": "integer|null",
      "coupons": "integer|null",
      "credit_card_level": "string|null",
      "settings": "object",
      "metadata": "object"
    },
    "app_state": {
      "is_authenticated": "boolean",
      "is_initialized": "boolean",
      "is_debug_mode": "boolean",
      "is_dashboard_balance_visible": "boolean",
      "is_profile_balance_visible": "boolean",
      "is_investment_balance_visible": "boolean",
      "total_assets": "float",
      "current_balance": "float",
      "holdings_total": "float",
      "card_count": "integer",
      "auth_type": "string",
      "has_token": "boolean",
      "needs_auth_refresh": "boolean"
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
  - `operating_system`: Operating system identifier
  - `operating_system_version`: Full OS version string
  - `environment`: Platform environment variables (string representation)
  - `resolved_executable`: Path to resolved executable
  - `package_config`: Package configuration path (nullable)

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
- `complete_user_profile`: Complete user profile data (nullable, all fields nullable)
  - Contains all user fields from BankUserModel including: id, name, nickname, username, email, phone, full_name, avatar, about, age, gender, birthday, date_of_birth, city, location, education, occupation, language, account_status, account_number, account_type, balance, currency, card_count, points, coupons, credit_card_level, last_login_at, login_attempts, street, state, zip_code, country, created_at, updated_at
- `global_app_data`: Global application data (nullable)
  - `last_active_time`: Last active timestamp (ISO8601)
  - `session_count`: Number of sessions
  - `app_version`: Application version
  - `location`: Global location setting
  - `city`: Global city setting
  - `balance`: Global balance
  - `username`: Global username
  - `full_name`: Global full name
  - `points`: User points
  - `coupons`: User coupons count
  - `credit_card_level`: Credit card level
  - `settings`: Application settings (object)
  - `metadata`: Application metadata (object)
- `app_state`: Current application state (nullable)
  - `is_authenticated`: Whether user is authenticated
  - `is_initialized`: Whether provider is initialized
  - `is_debug_mode`: Whether debug mode is enabled
  - `is_dashboard_balance_visible`: Dashboard balance visibility
  - `is_profile_balance_visible`: Profile balance visibility
  - `is_investment_balance_visible`: Investment balance visibility
  - `total_assets`: Total assets value
  - `current_balance`: Current balance (活期)
  - `holdings_total`: Total holdings value
  - `card_count`: Number of bank cards
  - `auth_type`: Authentication type
  - `has_token`: Whether authentication token exists
  - `needs_auth_refresh`: Whether auth refresh is needed

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
    },
    "complete_user_profile": {
      "id": "user_123",
      "username": "13800138000",
      "email": "user@example.com",
      "phone": "13800138000",
      "full_name": "*8000",
      "balance": 125000.50,
      "card_count": 2,
      "points": 5000,
      "coupons": 3,
      "account_status": "active",
      "last_login_at": "2026-01-26T10:00:00Z"
    },
    "global_app_data": {
      "last_active_time": "2026-01-26T10:30:00Z",
      "session_count": 15,
      "app_version": "1.0.0",
      "location": "北京市",
      "city": "北京市",
      "balance": 125000.50,
      "points": 5000,
      "coupons": 3,
      "settings": {
        "theme": "light",
        "language": "zh_CN"
      }
    },
    "app_state": {
      "is_authenticated": true,
      "is_initialized": true,
      "total_assets": 125000.50,
      "current_balance": 100000.00,
      "holdings_total": 50000.00,
      "card_count": 2,
      "auth_type": "jwt",
      "has_token": true
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
4. **Data Validation**: Validate all input data before storing
5. **Logging**: Log all submissions for audit purposes

### Error Handling

The endpoint should handle the following error cases:
- Invalid JSON format (400)
- Missing required fields (400)
- Database connection errors (500)
- Data validation errors (400)
- Server errors (500)

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
