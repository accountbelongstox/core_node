# AppFactory Backend API Endpoints Documentation
# API端点清单

**Base URL**: `http://localhost:8080/api/v1`

## Authentication Headers

Most endpoints require JWT authentication:
```
Authorization: Bearer <your_jwt_token>
```

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [APP Management](#app-management)
3. [Customer Service (CS)](#customer-service-cs)
4. [Technical Team](#technical-team)
5. [Statistics & Analytics](#statistics--analytics)

---

## 🔐 Authentication

### 1. Login
**Endpoint**: `POST /api/v1/auth/login`

**Access**: Public

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin",
    "avatar": "https://...",
    "phone": "+1-555-0101",
    "last_login": "2025-12-18T10:00:00Z"
  }
}
```

---

### 2. Register
**Endpoint**: `POST /api/v1/auth/register`

**Access**: Public

**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "cs"
}
```

**Response**: `201 Created`
```json
{
  "id": "user-uuid",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "cs"
}
```

---

### 3. Get Current User
**Endpoint**: `GET /api/v1/auth/me`

**Access**: Authenticated

**Response**: `200 OK`
```json
{
  "id": "user-uuid",
  "name": "John Doe",
  "email": "user@example.com",
  "role": "admin",
  "avatar": "https://...",
  "last_login": "2025-12-18T10:00:00Z"
}
```

---

## 📱 APP Management

### 4. Get All Apps
**Endpoint**: `GET /api/v1/apps`

**Access**: Authenticated (All roles)

**Query Parameters**:
- `status` (optional): Filter by status (Live, Pending, Failed, Idle, Generating)
- `category` (optional): Filter by category (Finance, Education, Health, etc.)
- `search` (optional): Search by name

**Example**: `GET /api/v1/apps?status=Live&category=Finance`

**Response**: `200 OK`
```json
[
  {
    "id": "app-uuid",
    "name": "Smart Expense Pro",
    "status": "Live",
    "category": "Finance",
    "visits": 12540,
    "revenue": 5200.00,
    "monthly_revenue": 8500.00,
    "daily_active_users": 2100,
    "description": "Advanced expense tracking with AI insights",
    "assigned_tech_id": "tech-uuid",
    "features": "[\"AI Analytics\",\"Budget Planning\",\"Receipt Scanner\"]",
    "target_audience": "Small Business Owners",
    "launch_date": "2025-12-10T00:00:00Z",
    "rating": 4.5,
    "created_at": "2025-12-10T00:00:00Z",
    "updated_at": "2025-12-17T00:00:00Z"
  }
]
```

---

### 5. Get App by ID
**Endpoint**: `GET /api/v1/apps/:id`

**Access**: Authenticated (All roles)

**Response**: `200 OK`
```json
{
  "id": "app-uuid",
  "name": "Smart Expense Pro",
  "status": "Live",
  "category": "Finance",
  "visits": 12540,
  "revenue": 5200.00,
  "monthly_revenue": 8500.00,
  "daily_active_users": 2100,
  "description": "Advanced expense tracking with AI insights",
  "assigned_tech_id": "tech-uuid",
  "features": "[\"AI Analytics\",\"Budget Planning\",\"Receipt Scanner\"]",
  "target_audience": "Small Business Owners",
  "launch_date": "2025-12-10T00:00:00Z",
  "rating": 4.5
}
```

---

### 6. Create App
**Endpoint**: `POST /api/v1/apps`

**Access**: Admin only

**Request Body**:
```json
{
  "name": "New Finance App",
  "category": "Finance",
  "description": "A revolutionary finance management tool",
  "features": ["Feature 1", "Feature 2", "Feature 3"],
  "target_audience": "Small Business Owners",
  "assigned_tech_id": "tech-uuid"
}
```

**Response**: `201 Created`
```json
{
  "id": "new-app-uuid",
  "name": "New Finance App",
  "status": "Generating",
  "category": "Finance",
  "visits": 0,
  "revenue": 0.00,
  "monthly_revenue": 0.00,
  "daily_active_users": 0,
  "description": "A revolutionary finance management tool",
  "assigned_tech_id": "tech-uuid"
}
```

---

### 7. Update App Status
**Endpoint**: `PUT /api/v1/apps/:id/status`

**Access**: Admin only

**Request Body**:
```json
{
  "status": "Live"
}
```

**Response**: `200 OK`
```json
{
  "id": "app-uuid",
  "name": "Smart Expense Pro",
  "status": "Live",
  "launch_date": "2025-12-18T10:00:00Z"
}
```

---

### 8. Delete App
**Endpoint**: `DELETE /api/v1/apps/:id`

**Access**: Admin only

**Response**: `200 OK`
```json
{
  "message": "App deleted successfully"
}
```

---

### 9. Get App Stats
**Endpoint**: `GET /api/v1/apps/:id/stats`

**Access**: Authenticated (All roles)

**Response**: `200 OK`
```json
{
  "app": {
    "id": "app-uuid",
    "name": "Smart Expense Pro",
    "visits": 12540,
    "revenue": 5200.00
  },
  "assignments": [
    {
      "cs_id": "cs-uuid",
      "app_id": "app-uuid",
      "cs": {
        "user_id": "cs-uuid",
        "user": {
          "name": "Alice Chen",
          "email": "alice@appfactory.com"
        },
        "status": "Online",
        "commission_rate": 15.0
      }
    }
  ],
  "revenues": [
    {
      "id": "rev-uuid",
      "cs_id": "cs-uuid",
      "app_id": "app-uuid",
      "revenue": 5200.00,
      "commission": 780.00,
      "promotions": 45
    }
  ]
}
```

---

### 10. Increment App Visit
**Endpoint**: `POST /api/v1/apps/:id/visit`

**Access**: Public (for tracking)

**Response**: `200 OK`
```json
{
  "visits": 12541
}
```

---

## 👥 Customer Service (CS)

### 11. Get All CS
**Endpoint**: `GET /api/v1/cs`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "user_id": "cs-uuid",
    "user": {
      "id": "cs-uuid",
      "name": "Alice Chen",
      "email": "alice@appfactory.com",
      "role": "cs",
      "avatar": "https://...",
      "phone": "+1-555-0102"
    },
    "status": "Online",
    "total_earnings": 12500.00,
    "commission_rate": 15.0
  }
]
```

---

### 12. Get CS by ID
**Endpoint**: `GET /api/v1/cs/:id`

**Access**: Admin only

**Response**: `200 OK`
```json
{
  "user_id": "cs-uuid",
  "user": {
    "id": "cs-uuid",
    "name": "Alice Chen",
    "email": "alice@appfactory.com",
    "role": "cs"
  },
  "status": "Online",
  "total_earnings": 12500.00,
  "commission_rate": 15.0
}
```

---

### 13. Get My Apps (CS)
**Endpoint**: `GET /api/v1/cs/my-apps`

**Access**: CS or Admin

**Response**: `200 OK`
```json
[
  {
    "id": "app1-uuid",
    "name": "Smart Expense Pro",
    "status": "Live",
    "visits": 12540,
    "revenue": 5200.00
  },
  {
    "id": "app2-uuid",
    "name": "FitTrack Plus",
    "status": "Live",
    "visits": 8920,
    "revenue": 3800.00
  }
]
```

---

### 14. Get My Revenue (CS)
**Endpoint**: `GET /api/v1/cs/my-revenue`

**Access**: CS or Admin

**Response**: `200 OK`
```json
{
  "total_revenue": 9000.00,
  "total_commission": 1350.00,
  "total_promotions": 77,
  "details": [
    {
      "id": "rev-uuid",
      "cs_id": "cs-uuid",
      "app_id": "app1-uuid",
      "revenue": 5200.00,
      "commission": 780.00,
      "promotions": 45
    },
    {
      "id": "rev-uuid-2",
      "cs_id": "cs-uuid",
      "app_id": "app2-uuid",
      "revenue": 3800.00,
      "commission": 570.00,
      "promotions": 32
    }
  ]
}
```

---

### 15. Get CS Performance
**Endpoint**: `GET /api/v1/cs/:id/performance`

**Access**: Admin only

**Response**: `200 OK`
```json
{
  "cs": {
    "user_id": "cs-uuid",
    "user": {
      "name": "Alice Chen",
      "email": "alice@appfactory.com"
    },
    "total_earnings": 12500.00,
    "commission_rate": 15.0
  },
  "assigned_apps": [
    {
      "cs_id": "cs-uuid",
      "app_id": "app-uuid",
      "app": {
        "name": "Smart Expense Pro",
        "revenue": 5200.00
      }
    }
  ],
  "total_revenue": 9000.00,
  "total_promotions": 77,
  "revenues": [...]
}
```

---

### 16. Get CS Ranking
**Endpoint**: `GET /api/v1/cs/ranking`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "user_id": "cs4-uuid",
    "user": {
      "name": "David Lee"
    },
    "total_earnings": 15300.00
  },
  {
    "user_id": "cs1-uuid",
    "user": {
      "name": "Alice Chen"
    },
    "total_earnings": 12500.00
  }
]
```

---

### 17. Assign CS to App
**Endpoint**: `POST /api/v1/cs/assign`

**Access**: Admin only

**Request Body**:
```json
{
  "app_id": "app-uuid",
  "cs_ids": ["cs1-uuid", "cs2-uuid", "cs3-uuid"]
}
```

**Response**: `200 OK`
```json
{
  "message": "CS assigned successfully"
}
```

---

### 18. Update CS Status
**Endpoint**: `PUT /api/v1/cs/status`

**Access**: CS or Admin

**Form Data**:
- `status`: "Online" or "Offline"

**Response**: `200 OK`
```json
{
  "user_id": "cs-uuid",
  "status": "Online"
}
```

---

## 🔧 Technical Team

### 19. Get All Tech
**Endpoint**: `GET /api/v1/tech`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "user_id": "tech-uuid",
    "user": {
      "id": "tech-uuid",
      "name": "Frank Zhang",
      "email": "frank@appfactory.com",
      "role": "tech"
    },
    "specialization": "Frontend",
    "apps_generated": 25,
    "status": "Available"
  }
]
```

---

### 20. Get My Tasks (Tech)
**Endpoint**: `GET /api/v1/tech/my-tasks`

**Access**: Tech or Admin

**Response**: `200 OK`
```json
[
  {
    "id": "req-uuid",
    "name": "PetCare Pro",
    "category": "Health",
    "description": "Comprehensive pet health tracking",
    "features": "[\"Health Records\",\"Vet Appointments\"]",
    "target_audience": "Pet Owners",
    "requested_by": "admin-uuid",
    "status": "in_progress",
    "assigned_tech_id": "tech-uuid",
    "estimated_completion_date": "2025-12-20T00:00:00Z"
  }
]
```

---

### 21. Get My Apps (Tech)
**Endpoint**: `GET /api/v1/tech/my-apps`

**Access**: Tech or Admin

**Response**: `200 OK`
```json
[
  {
    "id": "app-uuid",
    "name": "Smart Expense Pro",
    "status": "Live",
    "category": "Finance",
    "assigned_tech_id": "tech-uuid"
  }
]
```

---

### 22. Get App Generation Requests
**Endpoint**: `GET /api/v1/tech/requests`

**Access**: Admin only

**Query Parameters**:
- `status` (optional): Filter by status (pending, in_progress, completed, failed)

**Example**: `GET /api/v1/tech/requests?status=pending`

**Response**: `200 OK`
```json
[
  {
    "id": "req-uuid",
    "name": "RecipeShare",
    "category": "Social",
    "description": "Share and discover recipes",
    "features": "[\"Recipe Upload\",\"Search\",\"Rating System\"]",
    "target_audience": "Home Cooks",
    "requested_by": "admin-uuid",
    "status": "pending",
    "requested_at": "2025-12-18T09:00:00Z"
  }
]
```

---

### 23. Update Generation Request Status
**Endpoint**: `PUT /api/v1/tech/requests/:id/status`

**Access**: Admin only

**Form Data**:
- `status`: "pending", "in_progress", "completed", or "failed"

**Response**: `200 OK`
```json
{
  "id": "req-uuid",
  "name": "RecipeShare",
  "status": "in_progress"
}
```

---

### 24. Update Tech Status
**Endpoint**: `PUT /api/v1/tech/status`

**Access**: Tech or Admin

**Form Data**:
- `status`: "Available", "Busy", or "Offline"

**Response**: `200 OK`
```json
{
  "user_id": "tech-uuid",
  "status": "Busy"
}
```

---

## 📊 Statistics & Analytics

### 25. Get Dashboard Stats
**Endpoint**: `GET /api/v1/stats/dashboard`

**Access**: Admin only

**Response**: `200 OK`
```json
{
  "total_apps": 15,
  "live_apps": 11,
  "total_cs": 5,
  "total_tech": 4,
  "total_revenue": 71200.00,
  "total_visits": 168540,
  "avg_rating": 4.6
}
```

---

### 26. Get Daily Stats
**Endpoint**: `GET /api/v1/stats/daily`

**Access**: Admin only

**Query Parameters**:
- `days` (optional): Number of days (default: 7)

**Response**: `200 OK`
```json
[
  {
    "date": "12-18",
    "visits": 15200,
    "revenue": 8900.00,
    "new_apps": 2,
    "active_users": 28500
  },
  {
    "date": "12-17",
    "visits": 14800,
    "revenue": 8200.00,
    "new_apps": 1,
    "active_users": 27800
  }
]
```

---

### 27. Get Revenue by App
**Endpoint**: `GET /api/v1/stats/revenue/apps`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "id": "app10-uuid",
    "name": "GameZone Plus",
    "revenue": 15600.00,
    "category": "Entertainment"
  },
  {
    "id": "app7-uuid",
    "name": "SocialHub Connect",
    "revenue": 11200.00,
    "category": "Social"
  }
]
```

---

### 28. Get Revenue by CS
**Endpoint**: `GET /api/v1/stats/revenue/cs`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "user_id": "cs4-uuid",
    "user": {
      "name": "David Lee"
    },
    "total_earnings": 15300.00,
    "commission_rate": 18.0
  },
  {
    "user_id": "cs1-uuid",
    "user": {
      "name": "Alice Chen"
    },
    "total_earnings": 12500.00,
    "commission_rate": 15.0
  }
]
```

---

### 29. Get Revenue by Category
**Endpoint**: `GET /api/v1/stats/revenue/category`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "category": "Entertainment",
    "revenue": 15600.00,
    "count": 2
  },
  {
    "category": "Finance",
    "revenue": 15300.00,
    "count": 3
  },
  {
    "category": "Social",
    "revenue": 16800.00,
    "count": 2
  }
]
```

---

### 30. Get CS-APP Revenue Matrix
**Endpoint**: `GET /api/v1/stats/revenue/matrix`

**Access**: Admin only

**Response**: `200 OK`
```json
[
  {
    "id": "rev-uuid",
    "cs_id": "cs1-uuid",
    "app_id": "app1-uuid",
    "revenue": 5200.00,
    "commission": 780.00,
    "promotions": 45
  },
  {
    "id": "rev-uuid-2",
    "cs_id": "cs1-uuid",
    "app_id": "app2-uuid",
    "revenue": 3800.00,
    "commission": 570.00,
    "promotions": 32
  }
]
```

---

### 31. Get App Visit Trends
**Endpoint**: `GET /api/v1/stats/apps/:id/trends`

**Access**: Admin only

**Response**: `200 OK`
```json
{
  "app_id": "app-uuid",
  "total_visits": 12540,
  "daily_active_users": 2100,
  "revenue": 5200.00,
  "monthly_revenue": 8500.00
}
```

---

### 32. Health Check
**Endpoint**: `GET /health`

**Access**: Public

**Response**: `200 OK`
```json
{
  "status": "ok"
}
```

---

## 🔑 Authorization Matrix

| Endpoint Category | Admin | CS | Tech | Public |
|-------------------|-------|----|----|--------|
| Authentication | ✅ | ✅ | ✅ | ✅ (Login/Register) |
| App Management (Read) | ✅ | ✅ | ✅ | ❌ |
| App Management (Write) | ✅ | ❌ | ❌ | ❌ |
| CS Management | ✅ | ✅ (own data) | ❌ | ❌ |
| Tech Management | ✅ | ❌ | ✅ (own data) | ❌ |
| Statistics | ✅ | ❌ | ❌ | ❌ |
| Visit Tracking | ✅ | ✅ | ✅ | ✅ |

---

## 📝 Common Response Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Request successful, no content to return |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required or failed |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error occurred |

---

## 🚀 Quick Start

### 1. Start the server
```bash
cd appfactory-backend
go mod tidy
go run cmd/server/main.go
```

### 2. Test with cURL

**Login:**
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@appfactory.com","password":"password"}'
```

**Get all apps:**
```bash
curl -X GET http://localhost:8080/api/v1/apps \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📊 API Summary

- **Total Endpoints**: 32
- **Public Endpoints**: 3
- **Authenticated Endpoints**: 29
- **Admin-only Endpoints**: 17
- **CS Endpoints**: 4
- **Tech Endpoints**: 4
- **Statistics Endpoints**: 7

---

## 🔄 Data Flow Examples

### Example 1: Create and Launch an App
1. **Admin creates app**: `POST /api/v1/apps`
2. **System assigns tech**: App status = "Generating"
3. **Tech completes app**: `PUT /api/v1/tech/requests/:id/status`
4. **Admin launches app**: `PUT /api/v1/apps/:id/status` (status = "Live")
5. **Admin assigns CS**: `POST /api/v1/cs/assign`
6. **Users visit app**: `POST /api/v1/apps/:id/visit`
7. **Revenue tracked**: Automatically recorded

### Example 2: CS Views Performance
1. **CS logs in**: `POST /api/v1/auth/login`
2. **CS views assigned apps**: `GET /api/v1/cs/my-apps`
3. **CS checks revenue**: `GET /api/v1/cs/my-revenue`
4. **CS views app details**: `GET /api/v1/apps/:id/stats`

---

**Version**: 1.0.0
**Last Updated**: 2025-12-18
**Base URL**: `http://localhost:8080/api/v1`
