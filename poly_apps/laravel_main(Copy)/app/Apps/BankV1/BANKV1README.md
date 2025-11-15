# BankV1 API Documentation

**Version**: 1.0.0  
**Base URL**: `/api/bank`  
**Status**: Active  
**Last Updated**: 2025-01-07

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request Headers](#request-headers)
4. [Response Format](#response-format)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [App Lifecycle](#app-lifecycle-endpoints)
   - [User Management](#user-management-endpoints)
   - [Account Management](#account-management-endpoints)
   - [Transactions](#transaction-endpoints)
   - [Security](#security-endpoints)
   - [Admin - User Management](#admin-user-management)
   - [Admin - Device Management](#admin-device-management)
   - [Admin - Logs & Monitoring](#admin-logs--monitoring)
   - [Admin - Registration Codes](#admin-registration-codes)
   - [Admin - System Monitoring](#admin-system-monitoring)
   - [Utility](#utility-endpoints)
6. [Error Codes](#error-codes)
7. [Security Features](#security-features)
8. [Rate Limiting](#rate-limiting)

---

## Overview

BankV1 is a comprehensive banking API designed for Flutter mobile applications. It provides secure authentication, user management, transaction processing, device tracking, and admin controls.

### Key Features

- ✅ JWT-based authentication with refresh tokens
- ✅ Device registration and tracking
- ✅ App lifecycle monitoring
- ✅ Security checks and device locking
- ✅ Transaction management
- ✅ Admin controls for user and device management
- ✅ Comprehensive logging and monitoring
- ✅ Rate limiting and security features
- ✅ Registration code system

---

## Authentication

BankV1 uses JWT (JSON Web Tokens) for authentication. After successful login, you'll receive an access token and a refresh token.

### Authentication Flow

1. **Login/Register** → Receive `access_token` and `refresh_token`
2. **Use Access Token** → Include in `Authorization: Bearer {token}` header
3. **Token Expires** → Use `refresh_token` to get new `access_token`
4. **Logout** → Invalidate tokens on server

### Token Lifetime

- **Access Token**: Configurable (default: 1 hour)
- **Refresh Token**: Configurable (default: 30 days)

---

## Request Headers

### Standard Headers

```
Content-Type: application/json
Accept: application/json
```

### Authentication Header (for protected routes)

```
Authorization: Bearer {your_access_token}
```

### Optional Security Headers

```
X-Device-ID: {unique_device_identifier}
X-App-Signature: {application_signature}
X-Timestamp: {unix_timestamp}
X-Nonce: {random_nonce}
X-Platform: android|ios|web
X-App-Version: {app_version}
```

---

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details (optional)
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Too Many Requests (Rate Limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## API Endpoints

### Authentication Endpoints

#### 1. Login

**Endpoint**: `POST /api/bank/auth/login`  
**Authentication**: Not Required  
**Rate Limited**: Yes

**Request Body**:
```json
{
  "username": "john_doe",
  "password": "secure_password123",
  "device_id": "device_unique_id",
  "app_signature": "app_signature_hash"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "refresh_token_string",
    "expires_in": 3600,
    "user": {
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "full_name": "John Doe",
      "balance": 1000.00,
      "account_status": "active",
      "created_at": "2025-01-01T00:00:00Z"
    }
  },
  "message": "Login successful"
}
```

**Features**:
- ✅ Rate limiting protection
- ✅ Device tracking
- ✅ Security logging
- ✅ Failed login attempt tracking

---

#### 2. Register

**Endpoint**: `POST /api/bank/auth/register`  
**Authentication**: Not Required  
**Rate Limited**: Yes

**Request Body**:
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "secure_password123",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "device_id": "device_unique_id",
  "app_signature": "app_signature_hash"
}
```

**Validation Rules**:
- `username`: Required, unique, max length defined in config
- `email`: Required, valid email, unique
- `password`: Required, minimum 8 characters
- `full_name`: Required
- `phone`: Optional
- `device_id`: Optional
- `app_signature`: Optional

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "message": "Registration successful"
  },
  "message": "User registered successfully"
}
```

---

#### 3. Refresh Token

**Endpoint**: `POST /api/bank/auth/refresh`  
**Authentication**: Not Required (uses refresh token)

**Request Body**:
```json
{
  "refresh_token": "your_refresh_token_here"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "expires_in": 3600
  },
  "message": "Token refreshed successfully"
}
```

---

#### 4. Verify Token

**Endpoint**: `GET /api/bank/auth/verify`  
**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "user_id": "uuid",
      "username": "john_doe",
      "email": "john@example.com"
    }
  },
  "message": "Token is valid"
}
```

---

#### 5. Logout

**Endpoint**: `POST /api/bank/auth/logout`  
**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### App Lifecycle Endpoints

#### 1. App Open

**Endpoint**: `POST /api/bank/app/open`  
**Authentication**: Not Required

**Request Body**:
```json
{
  "device_id": "device_unique_id",
  "app_signature": "app_signature_hash",
  "timestamp": 1704556800,
  "event_type": "app_open",
  "app_version": "1.0.0",
  "platform": "android"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "session_id": "session_uuid",
    "server_config": {
      "maintenance_mode": false,
      "minimum_app_version": "1.0.0"
    },
    "device_locked": false,
    "lock_reason": null
  },
  "message": "App opened successfully"
}
```

**Features**:
- ✅ Device security check
- ✅ Session tracking
- ✅ Maintenance mode detection
- ✅ Device lock status

---

#### 2. App Close

**Endpoint**: `POST /api/bank/app/close`  
**Authentication**: Not Required

**Request Body**:
```json
{
  "device_id": "device_unique_id",
  "app_signature": "app_signature_hash",
  "timestamp": 1704556800,
  "event_type": "app_close",
  "session_duration": 300
}
```

**Response**:
```json
{
  "success": true,
  "message": "App closed successfully"
}
```

---

#### 3. Heartbeat

**Endpoint**: `POST /api/bank/app/heartbeat`  
**Authentication**: Required

**Request Body**:
```json
{
  "timestamp": 1704556800,
  "session_duration": 180
}
```

**Response**:
```json
{
  "success": true,
  "message": "Heartbeat recorded"
}
```

---

### User Management Endpoints

#### 1. Get User Profile

**Endpoint**: `GET /api/bank/user/profile`  
**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "phone": "+1234567890",
    "balance": 1000.00,
    "account_status": "active",
    "date_of_birth": "1990-01-01",
    "gender": "male",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001",
      "country": "USA"
    },
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-07T00:00:00Z"
  },
  "message": "Profile retrieved successfully"
}
```

---

#### 2. Update Profile

**Endpoint**: `PUT /api/bank/user/profile/update`  
**Authentication**: Required

**Request Body**:
```json
{
  "full_name": "John Updated Doe",
  "email": "john.updated@example.com",
  "phone": "+1234567890",
  "date_of_birth": "1990-01-01",
  "gender": "male",
  "updated_at": "2025-01-07T00:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    // Updated user data
  },
  "message": "Profile updated successfully"
}
```

**Features**:
- ✅ Logging of profile changes
- ✅ Timestamp validation
- ✅ Field-level updates

---

#### 3. Update Balance

**Endpoint**: `PUT /api/bank/user/balance/update`  
**Authentication**: Required

**Request Body**:
```json
{
  "new_balance": 1500.00,
  "timestamp": 1704556800,
  "reason": "deposit",
  "transaction_type": "credit"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "old_balance": 1000.00,
    "new_balance": 1500.00,
    "transaction_id": "txn_uuid"
  },
  "message": "Balance updated successfully"
}
```

**Features**:
- ✅ Transaction logging
- ✅ Security checks
- ✅ Audit trail

---

#### 4. Update Address

**Endpoint**: `PUT /api/bank/user/address/update`  
**Authentication**: Required

**Request Body**:
```json
{
  "street": "456 Oak Ave",
  "city": "Los Angeles",
  "state": "CA",
  "zip_code": "90001",
  "country": "USA",
  "updated_at": "2025-01-07T00:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "street": "456 Oak Ave",
    "city": "Los Angeles",
    "state": "CA",
    "zip_code": "90001",
    "country": "USA"
  },
  "message": "Address updated successfully"
}
```

---

#### 5. Register with Code

**Endpoint**: `POST /api/bank/user/register-code`  
**Authentication**: Required

**Request Body**:
```json
{
  "registration_code": "CODE123456",
  "timestamp": 1704556800,
  "referral_source": "friend"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "code_valid": true,
    "benefits": [
      "bonus_points",
      "premium_features"
    ]
  },
  "message": "Registration code applied successfully"
}
```

---

### Account Management Endpoints

#### 1. Get Balance

**Endpoint**: `GET /api/bank/account/balance`  
**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "balance": 1000.00,
    "currency": "USD",
    "last_updated": "2025-01-07T00:00:00Z"
  },
  "message": "Balance retrieved successfully"
}
```

---

#### 2. Get Transactions

**Endpoint**: `GET /api/bank/account/transactions`  
**Authentication**: Required

**Query Parameters**:
- `limit`: Number of transactions (default: 20)
- `offset`: Pagination offset (default: 0)
- `type`: Transaction type filter (credit|debit)
- `start_date`: Start date filter
- `end_date`: End date filter

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transaction_id": "txn_uuid",
        "type": "credit",
        "amount": 500.00,
        "balance_after": 1500.00,
        "description": "Deposit",
        "timestamp": "2025-01-07T00:00:00Z"
      }
    ],
    "total_count": 100,
    "limit": 20,
    "offset": 0
  },
  "message": "Transactions retrieved successfully"
}
```

---

#### 3. Get Statements

**Endpoint**: `GET /api/bank/account/statements`  
**Authentication**: Required

**Query Parameters**:
- `month`: Statement month (1-12)
- `year`: Statement year (YYYY)

**Response**:
```json
{
  "success": true,
  "data": {
    "statement_id": "stmt_uuid",
    "month": 1,
    "year": 2025,
    "opening_balance": 1000.00,
    "closing_balance": 1500.00,
    "total_credits": 1000.00,
    "total_debits": 500.00,
    "transactions": []
  },
  "message": "Statement retrieved successfully"
}
```

---

### Transaction Endpoints

#### 1. Transfer

**Endpoint**: `POST /api/bank/transactions/transfer`  
**Authentication**: Required

**Request Body**:
```json
{
  "recipient_id": "recipient_user_id",
  "amount": 100.00,
  "description": "Payment for services",
  "timestamp": 1704556800
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_uuid",
    "amount": 100.00,
    "recipient_id": "recipient_user_id",
    "sender_balance": 900.00,
    "status": "completed",
    "timestamp": "2025-01-07T00:00:00Z"
  },
  "message": "Transfer completed successfully"
}
```

---

#### 2. Payment

**Endpoint**: `POST /api/bank/transactions/payment`  
**Authentication**: Required

**Request Body**:
```json
{
  "merchant_id": "merchant_uuid",
  "amount": 50.00,
  "payment_method": "balance",
  "description": "Product purchase",
  "timestamp": 1704556800
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_uuid",
    "payment_status": "success",
    "amount": 50.00,
    "balance_after": 950.00
  },
  "message": "Payment processed successfully"
}
```

---

#### 3. Get Transaction

**Endpoint**: `GET /api/bank/transactions/{transactionId}`  
**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_uuid",
    "type": "debit",
    "amount": 50.00,
    "description": "Payment",
    "timestamp": "2025-01-07T00:00:00Z",
    "status": "completed"
  },
  "message": "Transaction retrieved successfully"
}
```

---

### Security Endpoints

#### 1. Register Device

**Endpoint**: `POST /api/bank/security/device/register`  
**Authentication**: Not Required

**Request Body**:
```json
{
  "device_id": "device_unique_id",
  "app_signature": "app_signature_hash",
  "registration_timestamp": 1704556800,
  "device_name": "John's iPhone",
  "platform": "ios",
  "app_version": "1.0.0"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "device_registered": true,
    "device_status": "active"
  },
  "message": "Device registered successfully"
}
```

---

#### 2. Get Device Status

**Endpoint**: `GET /api/bank/security/device/status`  
**Authentication**: Not Required

**Query Parameters**:
- `device_id`: Device identifier (required)

**Response**:
```json
{
  "success": true,
  "data": {
    "device_locked": false,
    "lock_reason": null,
    "device_status": "active"
  },
  "message": "Device status retrieved"
}
```

---

#### 3. Security Check

**Endpoint**: `POST /api/bank/security/check`  
**Authentication**: Not Required

**Request Body**:
```json
{
  "device_id": "device_unique_id",
  "app_signature": "app_signature_hash",
  "timestamp": 1704556800,
  "check_type": "app_integrity"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "security_status": "passed",
    "device_lock": false,
    "lock_reason": null
  },
  "message": "Security check passed"
}
```

---

### Admin - User Management

**Authentication**: Required (Admin Role)  
**Base Path**: `/api/bank/admin/users`

#### 1. Get All Users

**Endpoint**: `GET /api/bank/admin/users`

**Query Parameters**:
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by status (active|locked|suspended)
- `search`: Search by username/email

**Response**:
```json
{
  "success": true,
  "data": {
    "users": [],
    "total_count": 100,
    "limit": 50,
    "offset": 0
  },
  "message": "Users retrieved successfully"
}
```

---

#### 2. Get User by ID

**Endpoint**: `GET /api/bank/admin/users/{userId}`

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      // Full user details
    }
  },
  "message": "User retrieved successfully"
}
```

---

#### 3. Lock User

**Endpoint**: `PUT /api/bank/admin/users/{userId}/lock`

**Request Body**:
```json
{
  "reason": "Security violation",
  "duration": 86400
}
```

**Response**:
```json
{
  "success": true,
  "message": "User locked successfully"
}
```

---

#### 4. Unlock User

**Endpoint**: `PUT /api/bank/admin/users/{userId}/unlock`

**Response**:
```json
{
  "success": true,
  "message": "User unlocked successfully"
}
```

---

#### 5. Delete User

**Endpoint**: `DELETE /api/bank/admin/users/{userId}`

**Response**:
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### Admin - Device Management

**Authentication**: Required (Admin Role)  
**Base Path**: `/api/bank/admin/devices`

#### 1. Get All Devices

**Endpoint**: `GET /api/bank/admin/devices`

**Query Parameters**:
- `limit`: Results per page
- `offset`: Pagination offset
- `status`: Filter by status

---

#### 2. Get Device by ID

**Endpoint**: `GET /api/bank/admin/devices/{deviceId}`

---

#### 3. Lock Device

**Endpoint**: `PUT /api/bank/admin/devices/{deviceId}/lock`

---

#### 4. Unlock Device

**Endpoint**: `PUT /api/bank/admin/devices/{deviceId}/unlock`

---

#### 5. Delete Device

**Endpoint**: `DELETE /api/bank/admin/devices/{deviceId}`

---

### Admin - Logs & Monitoring

**Authentication**: Required (Admin Role)  
**Base Path**: `/api/bank/admin/logs`

#### 1. Get App Logs

**Endpoint**: `GET /api/bank/admin/logs/app`

**Query Parameters**:
- `start_date`: Start date filter
- `end_date`: End date filter
- `event_type`: Event type filter
- `limit`: Results limit

---

#### 2. Get Security Logs

**Endpoint**: `GET /api/bank/admin/logs/security`

**Query Parameters**:
- `start_date`: Start date filter
- `end_date`: End date filter
- `severity`: Severity filter (low|medium|high|critical)
- `limit`: Results limit

---

#### 3. Cleanup Logs

**Endpoint**: `POST /api/bank/admin/logs/cleanup`

**Request Body**:
```json
{
  "older_than_days": 90,
  "log_types": ["app", "security"]
}
```

---

### Admin - Registration Codes

**Authentication**: Required (Admin Role)  
**Base Path**: `/api/bank/admin/codes`

#### 1. Get All Codes

**Endpoint**: `GET /api/bank/admin/codes`

---

#### 2. Create Code

**Endpoint**: `POST /api/bank/admin/codes`

**Request Body**:
```json
{
  "code": "NEWCODE123",
  "max_uses": 100,
  "expires_at": "2025-12-31T23:59:59Z",
  "benefits": ["bonus_points", "premium_trial"]
}
```

---

#### 3. Update Code

**Endpoint**: `PUT /api/bank/admin/codes/{codeId}`

---

#### 4. Delete Code

**Endpoint**: `DELETE /api/bank/admin/codes/{codeId}`

---

#### 5. Get Code Usage

**Endpoint**: `GET /api/bank/admin/codes/{codeId}/usage`

---

### Admin - System Monitoring

**Authentication**: Required (Admin Role)  
**Base Path**: `/api/bank/admin/system`

#### 1. Get System Status

**Endpoint**: `GET /api/bank/admin/system/status`

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "database": "connected",
    "cache": "active",
    "queue": "running",
    "uptime": "10 days 5 hours",
    "active_sessions": 150,
    "active_devices": 500
  },
  "message": "System status retrieved"
}
```

---

#### 2. Get System Stats

**Endpoint**: `GET /api/bank/admin/system/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 10000,
      "active": 8500,
      "locked": 100
    },
    "devices": {
      "total": 5000,
      "active": 4500,
      "locked": 50
    },
    "transactions": {
      "today": 500,
      "this_month": 15000,
      "total_volume": 1000000.00
    }
  },
  "message": "System stats retrieved"
}
```

---

#### 3. Toggle Maintenance Mode

**Endpoint**: `POST /api/bank/admin/system/maintenance`

**Request Body**:
```json
{
  "enabled": true,
  "message": "System maintenance in progress",
  "estimated_duration": 3600
}
```

---

### Utility Endpoints

#### 1. API Info

**Endpoint**: `GET /api/bank/info`  
**Authentication**: Not Required

**Response**:
```json
{
  "app_name": "BankV1",
  "version": "1.0.0",
  "api_version": "v1",
  "status": "active",
  "timestamp": "2025-01-07T00:00:00Z",
  "endpoints": {
    "authentication": "/api/bank/auth/*",
    "user_management": "/api/bank/user/*",
    "app_lifecycle": "/api/bank/app/*",
    "security": "/api/bank/security/*",
    "admin": "/api/bank/admin/*"
  }
}
```

---

#### 2. Health Check

**Endpoint**: `GET /api/bank/health`  
**Authentication**: Not Required

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-01-07T00:00:00Z",
  "uptime": "N/A",
  "version": "1.0.0"
}
```

---

#### 3. Ping

**Endpoint**: `GET /api/bank/ping`  
**Authentication**: Not Required

**Response**:
```json
{
  "message": "pong",
  "timestamp": "2025-01-07T00:00:00Z"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INVALID_CREDENTIALS` | Username or password incorrect |
| `USER_NOT_FOUND` | User does not exist |
| `USER_LOCKED` | User account is locked |
| `DEVICE_LOCKED` | Device is locked |
| `TOKEN_EXPIRED` | Authentication token expired |
| `TOKEN_INVALID` | Authentication token invalid |
| `INSUFFICIENT_BALANCE` | Not enough balance for transaction |
| `TRANSACTION_FAILED` | Transaction processing failed |
| `UNAUTHORIZED` | Not authorized to access resource |
| `FORBIDDEN` | Access forbidden |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Internal server error |

---

## Security Features

### 1. Device Tracking
- Every request can include device identification
- Devices are registered and tracked
- Suspicious device activity triggers alerts

### 2. App Signature Verification
- Apps must provide signature for verification
- Prevents unauthorized app access
- Signature mismatch results in request rejection

### 3. Security Logging
- All authentication attempts logged
- Failed login attempts tracked
- Security events logged with severity levels

### 4. Device Locking
- Admin can lock suspicious devices
- Locked devices cannot access API
- Lock reasons are logged and tracked

### 5. Session Management
- App open/close events tracked
- Session duration monitored
- Heartbeat mechanism for active sessions

---

## Rate Limiting

Rate limiting is applied to prevent abuse:

### Login Endpoint
- **Limit**: 5 attempts per 15 minutes per IP
- **Scope**: Per IP address
- **Action**: Returns 429 status code when exceeded

### Registration Endpoint
- **Limit**: 3 registrations per hour per IP
- **Scope**: Per IP address
- **Action**: Returns 429 status code when exceeded

### General API Endpoints
- **Limit**: 100 requests per minute per user
- **Scope**: Per authenticated user
- **Action**: Returns 429 status code when exceeded

---

## Integration Guide

### Flutter Example

```dart
import 'package:qyflutter/common/network/network_framework.dart';
import 'package:qyflutter/common/network/controller/auth_controller.dart';

// Initialize the authentication controller
final authController = AuthController.createAuthObject(
  apiConfig: ApiConfig(
    baseUrl: 'https://api.si.12gm.com',
    authenticationType: AuthenticationType.headerAuth,
    responseValidation: ResponseValidationConfig.standard(),
  ),
  authEndpoints: {
    'login': '/api/bank/auth/login',
    'register': '/api/bank/auth/register',
    'logout': '/api/bank/auth/logout',
    'refresh': '/api/bank/auth/refresh',
  },
  userDataParser: (response) => response['data']['user'],
  tokenExtractor: (response) => response['data']['token'],
  tokenTypeExtractor: (response) => 'Bearer',
  expirationExtractor: (response) {
    final expiresIn = response['data']['expires_in'];
    return DateTime.now().add(Duration(seconds: expiresIn)).toIso8601String();
  },
  messageExtractor: (response) => response['message'],
  errorExtractor: (response) => response['error'] ?? response['message'],
);

// Login example
final result = await authController.login(
  username: 'john_doe',
  password: 'secure_password123',
  additionalData: {
    'device_id': 'device_unique_id',
    'app_signature': 'app_signature_hash',
  },
);

if (result.isSuccess) {
  print('Login successful: ${result.user}');
} else {
  print('Login failed: ${result.error}');
}
```

---

## Support & Contact

- **API Documentation**: https://api.si.12gm.com/docs
- **Base URL**: https://api.si.12gm.com
- **Support Email**: support@example.com
- **Version**: 1.0.0

---

**Last Updated**: January 7, 2025  
**Maintained by**: BankV1 Development Team

