# BankV1 API Bridge Documentation

## Overview

This document describes the API endpoints that the Flutter Bank App requires from the Laravel backend. The backend has been fully implemented to support the app's data submission functionality and management features.

## Implementation Status

✅ **Fully Implemented** - All endpoints are implemented and tested.

### Completed Features:

#### Public Endpoints (No Authentication Required):
- ✅ Data submission endpoint (`POST /api/bank/data/submit`)
- ✅ Authentication endpoints (`POST /api/bank/auth/login`, `register`, `refresh`)
- ✅ App lifecycle endpoints (`POST /api/bank/app/open`, `close`, `heartbeat`)
- ✅ Security endpoints (`POST /api/bank/security/device/register`, `GET /api/bank/security/device/status`, `POST /api/bank/security/check`)

#### Protected Endpoints (Require Authentication):
- ✅ User profile management (`GET /api/bank/user/profile`, `PUT /api/bank/user/profile/update`)
- ✅ Balance management (`PUT /api/bank/user/balance/update`)
- ✅ Address management (`PUT /api/bank/user/address/update`)
- ✅ Registration code (`POST /api/bank/user/register-code`)
- ✅ Account management (`GET /api/bank/account/balance`, `transactions`, `statements`)
- ✅ Transaction operations (`POST /api/bank/transactions/transfer`, `payment`)

#### Admin Endpoints (Require Sanctum Authentication):
- ✅ Admin statistics endpoint (`GET /api/bank/admin/data/stats`)
- ✅ Admin submissions query endpoint (`GET /api/bank/admin/data/submissions`)
- ✅ User management (`GET /api/bank/admin/users`, `GET /api/bank/admin/users/{userId}`, etc.)
- ✅ Device management (`GET /api/bank/admin/devices`, `PUT /api/bank/admin/devices/{deviceId}/lock`, etc.)
- ✅ Logs management (`GET /api/bank/admin/logs/app`, `GET /api/bank/admin/logs/security`)
- ✅ Registration codes management (`GET /api/bank/admin/codes`, `POST /api/bank/admin/codes`, etc.)
- ✅ System monitoring (`GET /api/bank/admin/system/status`, `GET /api/bank/admin/system/stats`)

#### Infrastructure:
- ✅ Database schema with proper encryption for sensitive data
- ✅ Service layer architecture for maintainability (`BankV1DataSubmissionService`, `BankV1DataQueryService`)
- ✅ Comprehensive error handling and logging
- ✅ Database initialization via `php artisan sys:init`
- ✅ Proper table prefixing (`bankv1_`) and connection management

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

**Implementation Note:** The health check endpoint is provided by the main API (`GET /api/health`), not by the BankV1 sub-application. This follows the architecture where the main API handles overall system health, while sub-applications focus on their specific functionalities.

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
  "success": true,
  "data": {
    "submission_id": "sub_20260126103045123_1",
    "received_at": "2026-01-26T10:30:45.456Z"
  },
  "message": "Data submitted successfully",
  "code": 200,
  "status": "success"
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "data": null,
  "message": "Validation failed",
  "error": {
    "device_info.device_id": ["The device info.device id field is required."]
  },
  "code": 400,
  "status": "error"
}
```

**Implementation Details:**
- Uses Laravel's `ApiResponse` trait for consistent response format
- Implements database transactions for data integrity
- Card numbers are encrypted using Laravel's `Crypt` facade
- Device submissions are idempotent (updates existing records if device_id exists)
- All operations are logged for audit purposes

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
  "success": true,
  "data": {
    "submission_id": "sub_20260126103045123_1",
    "received_at": "2026-01-26T10:30:45.456Z"
  },
  "message": "Data submitted successfully",
  "code": 200,
  "status": "success"
}
```

---

### 2. Admin Statistics Endpoint

**Endpoint:** `GET /api/bank/admin/data/stats`

**Description:** Retrieves aggregated statistics about data submissions for administrative purposes.

**Authentication:** Required (Sanctum Bearer Token)

**Request Headers:**
```
Authorization: Bearer {token}
Accept: application/json
```

**Response Format:**

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total_submissions": 150,
    "total_devices": 45,
    "total_users": 38,
    "total_cards": 203
  },
  "message": "Statistics retrieved successfully",
  "code": 200,
  "status": "success"
}
```

**Field Descriptions:**
- `total_submissions`: Total number of user data submissions
- `total_devices`: Total number of unique devices
- `total_users`: Total number of unique users (by phone number)
- `total_cards`: Total number of bank cards submitted

---

### 3. Admin Submissions Query Endpoint

**Endpoint:** `GET /api/bank/admin/data/submissions`

**Description:** Retrieves paginated list of data submissions with optional filtering.

**Authentication:** Required (Sanctum Bearer Token)

**Request Headers:**
```
Authorization: Bearer {token}
Accept: application/json
```

**Query Parameters:**
- `page` (optional, default: 1): Page number for pagination
- `per_page` (optional, default: 20): Number of items per page
- `device_id` (optional): Filter by device ID
- `start_date` (optional): Filter submissions from this date (ISO8601)
- `end_date` (optional): Filter submissions until this date (ISO8601)

**Response Format:**

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "device_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        "device_name": "Windows Device",
        "platform": "windows",
        "phone": "13800138000",
        "full_name": "*8000",
        "total_balance": 125000.50,
        "submit_time": "2026-01-26T10:30:45.000000Z",
        "created_at": "2026-01-26T10:30:45.000000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8
    }
  },
  "message": "Submissions retrieved successfully",
  "code": 200,
  "status": "success"
}
```

**Example Request:**
```
GET /api/bank/admin/data/submissions?page=1&per_page=50&device_id=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Implementation Requirements

### Database Schema Implementation

The backend stores the submitted data in the following database tables (all prefixed with `bankv1_`):

**Database Connection:** `bankv1` (SQLite: `/www/wwwroot/laravel_db/bank_v1_database.sqlite`)

1. **bankv1_device_submissions** table:
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

2. **bankv1_registration_submissions** table:
   - `id` (primary key)
   - `device_id` (foreign key to device_submissions)
   - `registration_code` (indexed)
   - `is_registered`
   - `is_super_user`
   - `registration_time`
   - `expiration_time`
   - `created_at`
   - `updated_at`

3. **bankv1_user_data_submissions** table:
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

4. **bankv1_bank_card_submissions** table:
   - `id` (primary key)
   - `user_data_submission_id` (foreign key to user_data_submissions)
   - `card_number` (indexed, encrypted)
   - `card_type`
   - `balance`
   - `currency`
   - `opened_at`
   - `created_at`
   - `updated_at`

### Security Implementation

1. **Data Encryption**: ✅ Card numbers are encrypted using Laravel's `Crypt::encryptString()` before storage
2. **IP Validation**: ✅ IP addresses are validated and automatically captured from request
3. **Rate Limiting**: ⚠️ Rate limiting can be added via Laravel middleware if needed
4. **Data Validation**: ✅ Comprehensive validation using Laravel Validator with detailed error messages
5. **Logging**: ✅ All submissions are logged with device_id and submission_id for audit purposes
6. **Database Transactions**: ✅ All data operations use database transactions for atomicity
7. **Idempotency**: ✅ Device submissions are idempotent (updates existing records if device_id exists)

### Error Handling & Fault Tolerance

The backend implements comprehensive error handling without throwing exceptions:

1. **No Exception Throwing**: ✅ All service methods return result arrays instead of throwing exceptions
   - Format: `['success' => bool, 'id' => int|null, 'error' => string|null]`
   - All errors are logged and returned as structured responses

2. **Database Connection Resilience**: ✅ Automatic retry mechanism (3 attempts with 100ms delay)
   - Handles temporary database connection failures gracefully
   - Logs all retry attempts and final failures

3. **Data Parsing Tolerance**: ✅ Graceful handling of malformed data
   - Date parsing failures fall back to current time
   - JSON encoding/decoding errors are logged and handled
   - Invalid card numbers are skipped (not blocking entire submission)

4. **Partial Success Handling**: ✅ Continues processing even if some operations fail
   - Card saving failures don't block user data submission
   - Each card is processed independently
   - Success/failure counts are logged

5. **Comprehensive Logging**: ✅ All errors are logged with context
   - Device IDs, submission IDs, error messages, and stack traces
   - Warning level for non-critical issues (date parsing, JSON encoding)
   - Error level for critical failures (database errors, encryption failures)

6. **Safe Defaults**: ✅ All operations use safe defaults
   - Empty strings for missing device names
   - Null values for optional fields
   - Empty arrays for missing card lists
   - Current timestamp for invalid dates

7. **Query Error Handling**: ✅ Statistics and query endpoints handle failures gracefully
   - Returns empty arrays/default values instead of throwing
   - Each query operation is wrapped in try-catch
   - Individual query failures don't block entire response

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

## Architecture Notes

### Service Layer Architecture

The implementation follows a service-oriented architecture:

- **BankV1DataSubmissionService**: Handles data persistence logic
  - `saveDeviceSubmission()`: Saves/updates device information
  - `saveRegistrationSubmission()`: Saves registration data
  - `saveUserDataSubmission()`: Saves user data
  - `saveBankCards()`: Saves encrypted card information

- **BankV1DataQueryService**: Handles data retrieval logic
  - `getStats()`: Aggregates statistics
  - `getSubmissions()`: Retrieves paginated submissions with filtering

- **BankV1DataSubmissionCtl**: Controller handling HTTP requests and responses

### Database Initialization

The database is initialized via `php artisan sys:init` command, which:
- Creates the `bankv1` database connection
- Runs migrations to create all required tables
- Sets up proper indexes and foreign key constraints

### Response Format Standard

All endpoints use the `ApiResponse` trait for consistent JSON responses:
```json
{
  "success": boolean,
  "data": object|array|null,
  "message": string,
  "error": object|string|null,
  "code": integer,
  "status": "success"|"error"
}
```

## Notes

- ✅ The app submits data silently in the background - no user-visible network status is shown
- ✅ The endpoint is idempotent - multiple submissions from the same device update existing records gracefully
- ✅ Data deduplication is handled based on device_id (updates existing device records)
- ✅ The endpoint responds quickly (< 2 seconds) to avoid blocking the app
- ✅ All timestamps are in ISO8601 format with timezone information
- ✅ Card numbers are encrypted at rest using Laravel's encryption
- ✅ All operations use database transactions for data integrity
- ✅ Comprehensive error logging for debugging and audit purposes
