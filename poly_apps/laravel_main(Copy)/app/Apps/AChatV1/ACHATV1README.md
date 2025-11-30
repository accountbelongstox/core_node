# AChatV1 API

Real-time messaging and collaboration backend API for AChat application.

## API Information

- **Base URL**: `https://apiv1.achat.fun`
- **Base Path**: `/achat/v1`
- **Version**: `1.0.0`
- **Authentication**: JWT Bearer Token

## Quick Start

### Test API Health

```bash
curl https://apiv1.achat.fun/achat/v1/health
```

### Get API Information

```bash
curl https://apiv1.achat.fun/achat/v1/info
```

## Endpoints Overview

### Public Endpoints

- `GET /achat/v1/info` - API information
- `GET /achat/v1/health` - Health check

### Planned Endpoints

- `POST /achat/v1/auth/login` - User login
- `POST /achat/v1/auth/register` - User registration
- `POST /achat/v1/auth/logout` - User logout
- `POST /achat/v1/auth/refresh` - Refresh token
- `GET /achat/v1/users/{id}` - Get user profile
- `PUT /achat/v1/users/profile` - Update user profile
- `GET /achat/v1/users/search` - Search users
- `GET /achat/v1/conversations` - List conversations
- `POST /achat/v1/conversations` - Create conversation
- `GET /achat/v1/conversations/{id}/messages` - Get messages
- `POST /achat/v1/conversations/{id}/messages` - Send message
- `PUT /achat/v1/messages/{id}/read` - Mark as read
- `DELETE /achat/v1/messages/{id}` - Delete message
- `POST /achat/v1/groups` - Create group
- `PUT /achat/v1/groups/{id}` - Update group
- `POST /achat/v1/groups/{id}/members` - Add member
- `DELETE /achat/v1/groups/{id}/members/{userId}` - Remove member
- `POST /achat/v1/files/upload` - Upload file
- `POST /achat/v1/devices/register` - Register device
- `PUT /achat/v1/devices/update` - Update device
- `POST /achat/v1/app/open` - App opened
- `POST /achat/v1/app/close` - App closed
- `POST /achat/v1/app/heartbeat` - Heartbeat

## Features

- Real-time messaging
- Group chats
- File sharing
- User presence tracking
- Message read receipts
- Device management
- Cross-app data consistency
- WebSocket support (planned)

## Configuration

All configuration is centralized in:
```
app/Apps/AChatV1/AChatV1Gvar/AChatV1Config.php
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Development Status

- ✅ API structure created
- ✅ Health check endpoint
- ✅ API info endpoint
- ⏳ Authentication endpoints (planned)
- ⏳ User management (planned)
- ⏳ Messaging system (planned)
- ⏳ Group management (planned)
- ⏳ File upload (planned)
- ⏳ WebSocket integration (planned)

## Directory Structure

```
AChatV1/
├── AChatV1ApiInfo.php               # API metadata
├── AChatV1Controllers/              # Controllers
│   └── AChatV1ApiInfoCtl.php       # Info controller
├── AChatV1Gvar/                    # Global variables
│   └── AChatV1Config.php           # Configuration
├── AChatV1TablesMaps/              # Database mappings
└── AChatV1Utils/                   # Utilities
```

## Routes

Routes are defined in:
```
routes/achat_v1/api_info.php
```

All routes are included in:
```
routes/api.php
```

## Next Steps

1. Implement authentication system
2. Create user management endpoints
3. Build messaging system
4. Add group chat functionality
5. Implement file upload
6. Add WebSocket support
7. Create comprehensive API tests

## Notes

- This API follows Laravel 12 conventions
- All responses use consistent JSON format
- JWT authentication for protected routes
- Rate limiting: 60 requests per minute
- Maximum page size: 100 items
- File upload limit: 10MB

