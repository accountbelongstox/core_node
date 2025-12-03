# React Native App - Backend API Specification

This document specifies all API endpoints and data formats required by the React Native application. The backend can be implemented in any language/framework.

## Base Configuration

- **Base URL**: `https://api.example.com` (configurable via `API_BASE_URL` environment variable)
- **Content-Type**: `application/json`
- **Authentication**: Token-based (Bearer token in Authorization header)
- **Response Format**: JSON

## Authentication

All authenticated requests must include:
```
Authorization: Bearer <access_token>
```

---

## 1. Authentication Endpoints

### 1.1 Send Verification Code
**POST** `/api/auth/send-code`

**Request Body:**
```json
{
  "phone": "13800138000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent",
  "data": {
    "expiresIn": 300
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PHONE",
    "message": "Invalid phone number format"
  }
}
```

---

### 1.2 Login
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "u1",
      "name": "Alex Chen",
      "phone": "13800138000",
      "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=Alex",
      "signature": "Stay safe, stay connected.",
      "gender": "male",
      "address": "Beijing, China",
      "email": "alex@example.com",
      "idCard": "11010119900101****"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "expiresIn": 3600
  }
}
```

---

### 1.3 Register
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "phone": "13800138000",
  "code": "123456",
  "name": "Alex Chen"
}
```

**Response:** (Same as Login)

---

### 1.4 Social Login
**POST** `/api/auth/social-login`

**Request Body:**
```json
{
  "provider": "wechat" | "qq" | "alipay",
  "code": "social_auth_code",
  "accessToken": "social_access_token"
}
```

**Response:** (Same as Login)

---

### 1.5 Refresh Token
**POST** `/api/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "expiresIn": 3600
  }
}
```

---

### 1.6 Logout
**POST** `/api/auth/logout`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 2. User Endpoints

### 2.1 Get Current User
**GET** `/api/user/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "u1",
    "name": "Alex Chen",
    "phone": "13800138000",
    "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=Alex",
    "signature": "Stay safe, stay connected.",
    "gender": "male" | "female",
    "address": "Beijing, China",
    "birthday": "1990-01-01",
    "email": "alex@example.com",
    "idCard": "11010119900101****",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 2.2 Update User Profile
**PUT** `/api/user/me`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Alex Chen",
  "signature": "Stay safe, stay connected.",
  "email": "alex@example.com",
  "address": "Beijing, China",
  "idCard": "11010119900101****"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "u1",
    "name": "Alex Chen",
    "phone": "13800138000",
    "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=Alex",
    "signature": "Stay safe, stay connected.",
    "gender": "male",
    "address": "Beijing, China",
    "email": "alex@example.com",
    "idCard": "11010119900101****",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### 2.3 Upload Avatar
**POST** `/api/user/avatar`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```
FormData with field: "avatar" (image file)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "avatar": "https://cdn.example.com/avatars/u1_avatar.jpg"
  }
}
```

---

## 3. Friends Endpoints

### 3.1 Get Friends List
**GET** `/api/friends`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): `all` | `online` | `monitored` | `alerts`
- `search` (optional): Search query string

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "f1",
      "name": "Sarah",
      "phone": "13900000000",
      "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=Sarah",
      "gender": "female",
      "relation": "Partner" | "Child" | "Parent" | "Friend",
      "daysConnected": 1314,
      "lastActive": "Just now" | "10 min ago" | "1 hour ago",
      "lastActiveTimestamp": "2024-01-01T10:45:00Z",
      "isMonitored": true,
      "location": {
        "lat": 39.9042,
        "lng": 116.4074,
        "address": "Near Palace Museum",
        "updatedAt": "2024-01-01T10:45:00Z"
      },
      "health": {
        "steps": 8432,
        "heartRate": 78,
        "temp": 36.5,
        "updatedAt": "2024-01-01T10:45:00Z"
      },
      "device": {
        "network": "WiFi" | "4G" | "5G",
        "unlocks": 42,
        "usageTime": "5h 20m",
        "battery": 85,
        "updatedAt": "2024-01-01T10:45:00Z"
      },
      "chat": {
        "lastMessage": "Are you coming home for dinner?",
        "unreadCount": 3,
        "lastMessageTime": "2024-01-01T10:45:00Z"
      }
    }
  ]
}
```

---

### 3.2 Get Friend Detail
**GET** `/api/friends/:friendId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "f1",
    "name": "Sarah",
    "phone": "13900000000",
    "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=Sarah",
    "gender": "female",
    "relation": "Partner",
    "daysConnected": 1314,
    "lastActive": "Just now",
    "lastActiveTimestamp": "2024-01-01T10:45:00Z",
    "isMonitored": true,
    "location": {
      "lat": 39.9042,
      "lng": 116.4074,
      "address": "Near Palace Museum",
      "updatedAt": "2024-01-01T10:45:00Z"
    },
    "health": {
      "steps": 8432,
      "heartRate": 78,
      "temp": 36.5,
      "updatedAt": "2024-01-01T10:45:00Z"
    },
    "device": {
      "network": "5G",
      "unlocks": 42,
      "usageTime": "4h 15m",
      "battery": 85,
      "updatedAt": "2024-01-01T10:45:00Z"
    },
    "places": [
      {
        "name": "Central Park",
        "lat": 39.9042,
        "lng": 116.4074,
        "duration": "2h 30m",
        "visitedAt": "2024-01-01T08:00:00Z"
      }
    ]
  }
}
```

---

### 3.3 Search Users
**GET** `/api/users/search`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `phone` (required): Phone number to search
- `q` (optional): General search query

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "u2",
      "name": "John Doe",
      "phone": "138****8888",
      "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=John",
      "isFriend": false,
      "hasPendingRequest": false
    }
  ]
}
```

---

### 3.4 Send Friend Request
**POST** `/api/friends/requests`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userId": "u2",
  "message": "Hi, I'm Alex. Please add me.",
  "alias": "Uncle John",
  "relation": "Family" | "Partner" | "Friend"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Friend request sent",
  "data": {
    "requestId": "req1",
    "status": "pending"
  }
}
```

---

### 3.5 Get Friend Requests
**GET** `/api/friends/requests`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` (optional): `sent` | `received` (default: `received`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "req1",
      "from": {
        "id": "u2",
        "name": "John Doe",
        "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=John"
      },
      "to": {
        "id": "u1",
        "name": "Alex Chen",
        "avatar": "https://api.dicebear.com/7.x/avataaars/png?seed=Alex"
      },
      "message": "Hi, I'm John. Please add me.",
      "alias": "Uncle John",
      "relation": "Family",
      "status": "pending" | "accepted" | "rejected",
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

---

### 3.6 Accept/Reject Friend Request
**PUT** `/api/friends/requests/:requestId`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "action": "accept" | "reject"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Friend request accepted",
  "data": {
    "friend": {
      "id": "f1",
      "name": "John Doe",
      "relation": "Family"
    }
  }
}
```

---

### 3.7 Toggle Monitor Status
**PUT** `/api/friends/:friendId/monitor`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "isMonitored": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "friendId": "f1",
    "isMonitored": true
  }
}
```

---

### 3.8 Remove Friend
**DELETE** `/api/friends/:friendId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Friend removed"
}
```

---

## 4. Location Endpoints

### 4.1 Get Friend Location
**GET** `/api/friends/:friendId/location`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lat": 39.9042,
    "lng": 116.4074,
    "address": "Near Palace Museum",
    "accuracy": 10.5,
    "speed": 0,
    "heading": 0,
    "updatedAt": "2024-01-01T10:45:00Z"
  }
}
```

---

### 4.2 Get Location History
**GET** `/api/friends/:friendId/history`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `limit` (optional): Number of records (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "points": [
      {
        "id": "loc1",
        "time": "18:30",
        "date": "2024-01-01",
        "timestamp": "2024-01-01T18:30:00Z",
        "location": "Home Sweet Home",
        "address": "123 Main St, Beijing",
        "duration": "Arrived",
        "lat": 39.9042,
        "lng": 116.4074
      },
      {
        "id": "loc2",
        "time": "17:15",
        "date": "2024-01-01",
        "timestamp": "2024-01-01T17:15:00Z",
        "location": "City Gym Center",
        "address": "456 Gym St, Beijing",
        "duration": "1h 15m",
        "lat": 39.9142,
        "lng": 116.4174
      }
    ],
    "summary": {
      "totalDistance": 15.9,
      "unit": "km",
      "date": "2024-01-01"
    },
    "pagination": {
      "total": 100,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### 4.3 Upload Location (for device/app tracking)
**POST** `/api/location`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "lat": 39.9042,
  "lng": 116.4074,
  "accuracy": 10.5,
  "speed": 0,
  "heading": 0,
  "timestamp": "2024-01-01T10:45:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "locationId": "loc1",
    "address": "Near Palace Museum",
    "updatedAt": "2024-01-01T10:45:00Z"
  }
}
```

---

## 5. Health Data Endpoints

### 5.1 Get Friend Health Data
**GET** `/api/friends/:friendId/health`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `date` (optional): ISO 8601 date string (default: today)

**Response:**
```json
{
  "success": true,
  "data": {
    "steps": 8432,
    "heartRate": 78,
    "temp": 36.5,
    "date": "2024-01-01",
    "updatedAt": "2024-01-01T10:45:00Z"
  }
}
```

---

### 5.2 Get Health History
**GET** `/api/friends/:friendId/health/history`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string
- `metric` (optional): `steps` | `heartRate` | `temp`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-01",
      "steps": 8432,
      "heartRate": 78,
      "temp": 36.5
    },
    {
      "date": "2023-12-31",
      "steps": 9200,
      "heartRate": 75,
      "temp": 36.4
    }
  ]
}
```

---

## 6. Device Data Endpoints

### 6.1 Get Friend Device Info
**GET** `/api/friends/:friendId/device`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "network": "WiFi" | "4G" | "5G",
    "unlocks": 42,
    "usageTime": "5h 20m",
    "usageTimeMinutes": 320,
    "battery": 85,
    "lastUnlock": "2024-01-01T10:45:00Z",
    "updatedAt": "2024-01-01T10:45:00Z"
  }
}
```

---

## 7. Chat Endpoints

### 7.1 Get Chat Messages
**GET** `/api/chat/:friendId/messages`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages (default: 50)
- `before` (optional): Message ID to fetch messages before
- `after` (optional): Message ID to fetch messages after

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg1",
        "senderId": "f1",
        "receiverId": "u1",
        "content": "Hey, are you still at the gym?",
        "type": "text",
        "timestamp": "2024-01-01T10:45:00Z",
        "read": true
      },
      {
        "id": "msg2",
        "senderId": "u1",
        "receiverId": "f1",
        "content": "Just leaving now!",
        "type": "text",
        "timestamp": "2024-01-01T10:46:00Z",
        "read": true
      }
    ],
    "hasMore": false
  }
}
```

---

### 7.2 Send Message
**POST** `/api/chat/:friendId/messages`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "content": "Just leaving now!",
  "type": "text"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg2",
    "senderId": "u1",
    "receiverId": "f1",
    "content": "Just leaving now!",
    "type": "text",
    "timestamp": "2024-01-01T10:46:00Z",
    "read": false
  }
}
```

---

### 7.3 Mark Messages as Read
**PUT** `/api/chat/:friendId/messages/read`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "messageIds": ["msg1", "msg2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "readCount": 2
  }
}
```

---

### 7.4 Get Unread Count
**GET** `/api/chat/unread-count`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "byFriend": {
      "f1": 3,
      "f2": 2
    }
  }
}
```

---

## 8. Products/Shop Endpoints

### 8.1 Get Products List
**GET** `/api/products`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `category` (optional): `watch` | `accessory` | `health`
- `lat` (optional): Latitude for distance calculation
- `lng` (optional): Longitude for distance calculation
- `limit` (optional): Number of products (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "p1",
        "name": "安无忧手表版",
        "nameEn": "SafeGuardian Watch Edition",
        "price": "¥299",
        "priceNum": 299,
        "currency": "CNY",
        "dist": "1.2km",
        "distance": 1200,
        "rating": 4.8,
        "image": "https://cdn.example.com/products/watch.jpg",
        "images": [
          "https://cdn.example.com/products/watch_1.jpg",
          "https://cdn.example.com/products/watch_2.jpg"
        ],
        "description": "智能安全手表，实时定位，一键求救",
        "descriptionEn": "Smart safety watch with real-time location and SOS button",
        "category": "watch",
        "inStock": true,
        "stockCount": 50
      }
    ],
    "pagination": {
      "total": 100,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### 8.2 Get Product Detail
**GET** `/api/products/:productId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "p1",
    "name": "安无忧手表版",
    "nameEn": "SafeGuardian Watch Edition",
    "price": "¥299",
    "priceNum": 299,
    "currency": "CNY",
    "dist": "1.2km",
    "distance": 1200,
    "rating": 4.8,
    "reviewsCount": 1250,
    "image": "https://cdn.example.com/products/watch.jpg",
    "images": [
      "https://cdn.example.com/products/watch_1.jpg",
      "https://cdn.example.com/products/watch_2.jpg"
    ],
    "description": "智能安全手表，实时定位，一键求救",
    "descriptionEn": "Smart safety watch with real-time location and SOS button",
    "category": "watch",
    "specifications": {
      "battery": "7 days",
      "waterproof": "IP68",
      "screen": "1.4 inch"
    },
    "inStock": true,
    "stockCount": 50
  }
}
```

---

## 9. AI Assistant Endpoints

### 9.1 Send AI Message
**POST** `/api/ai/chat`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "message": "What are the safety trends for my family this week?",
  "context": {
    "friendIds": ["f1", "f2"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ai_msg1",
    "message": "Based on the data, your family members have been active this week. Sarah has maintained regular activity patterns, and Mom has been staying close to home. No safety alerts detected.",
    "timestamp": "2024-01-01T10:50:00Z"
  }
}
```

---

### 9.2 Get AI Chat History
**GET** `/api/ai/chat/history`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "ai_msg1",
        "role": "user",
        "content": "What are the safety trends for my family this week?",
        "timestamp": "2024-01-01T10:50:00Z"
      },
      {
        "id": "ai_msg2",
        "role": "assistant",
        "content": "Based on the data, your family members have been active this week...",
        "timestamp": "2024-01-01T10:50:05Z"
      }
    ],
    "hasMore": false
  }
}
```

---

## 10. Places Endpoints

### 10.1 Get Friend Places
**GET** `/api/friends/:friendId/places`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `date` (optional): ISO 8601 date string (default: today)
- `limit` (optional): Number of places (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "place1",
      "name": "Central Park",
      "lat": 39.9042,
      "lng": 116.4074,
      "address": "Central Park, Beijing",
      "duration": "2h 30m",
      "durationMinutes": 150,
      "visitedAt": "2024-01-01T08:00:00Z",
      "leftAt": "2024-01-01T10:30:00Z"
    }
  ]
}
```

---

## 11. Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes:

- `UNAUTHORIZED` (401): Missing or invalid authentication token
- `FORBIDDEN` (403): User doesn't have permission
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Request validation failed
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

---

## 12. Data Types Reference

### User
```typescript
{
  id: string;
  name: string;
  phone: string;
  avatar: string;
  signature?: string;
  gender?: "male" | "female";
  address?: string;
  birthday?: string;
  email?: string;
  idCard?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Friend
```typescript
{
  id: string;
  name: string;
  phone: string;
  avatar: string;
  gender?: "male" | "female";
  relation: "Partner" | "Child" | "Parent" | "Friend";
  daysConnected: number;
  lastActive: string;
  lastActiveTimestamp: string; // ISO 8601
  isMonitored: boolean;
  location?: {
    lat: number;
    lng: number;
    address: string;
    updatedAt: string; // ISO 8601
  };
  health?: {
    steps: number;
    heartRate: number;
    temp: number;
    updatedAt: string; // ISO 8601
  };
  device?: {
    network: "WiFi" | "4G" | "5G";
    unlocks: number;
    usageTime: string;
    battery?: number;
    updatedAt: string; // ISO 8601
  };
  chat?: {
    lastMessage: string;
    unreadCount: number;
    lastMessageTime: string; // ISO 8601
  };
}
```

### Location Point
```typescript
{
  id: string;
  time: string; // "HH:mm"
  date: string; // "YYYY-MM-DD"
  timestamp: string; // ISO 8601
  location: string;
  address: string;
  duration: string;
  lat: number;
  lng: number;
}
```

### Product
```typescript
{
  id: string;
  name: string;
  nameEn: string;
  price: string;
  priceNum: number;
  currency: string;
  dist: string;
  distance: number; // in meters
  rating: number;
  image: string;
  images?: string[];
  description: string;
  descriptionEn?: string;
  category: "watch" | "accessory" | "health";
  inStock: boolean;
  stockCount?: number;
}
```

---

## 13. WebSocket/Real-time Updates (Optional)

For real-time updates, consider implementing WebSocket connections:

**WebSocket URL:** `wss://api.example.com/ws`

**Connection:**
```
Authorization: Bearer <token>
```

**Message Types:**

1. **Location Update:**
```json
{
  "type": "location_update",
  "data": {
    "friendId": "f1",
    "location": {
      "lat": 39.9042,
      "lng": 116.4074,
      "address": "Near Palace Museum"
    }
  }
}
```

2. **Health Update:**
```json
{
  "type": "health_update",
  "data": {
    "friendId": "f1",
    "health": {
      "steps": 8432,
      "heartRate": 78,
      "temp": 36.5
    }
  }
}
```

3. **New Message:**
```json
{
  "type": "new_message",
  "data": {
    "messageId": "msg1",
    "friendId": "f1",
    "content": "New message",
    "timestamp": "2024-01-01T10:50:00Z"
  }
}
```

4. **Friend Request:**
```json
{
  "type": "friend_request",
  "data": {
    "requestId": "req1",
    "from": {
      "id": "u2",
      "name": "John Doe"
    }
  }
}
```

---

## 14. Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **General endpoints**: 100 requests per minute per user
- **Location upload**: 10 requests per minute per user
- **Chat messages**: 30 messages per minute per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

---

## 15. Pagination

All list endpoints support pagination:

**Query Parameters:**
- `limit`: Number of items per page (default: 20, max: 100)
- `offset`: Number of items to skip (default: 0)

**Response includes:**
```json
{
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## 16. File Upload

For file uploads (avatars, images), use `multipart/form-data`:

**Content-Type:** `multipart/form-data`

**Request:**
```
POST /api/user/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
  avatar: <file>
```

**File Size Limits:**
- Avatar: 5MB max
- Product images: 10MB max
- Supported formats: JPEG, PNG, WebP

---

## 17. Notes for Backend Implementation

1. **Time Zones**: All timestamps should be in ISO 8601 format with timezone information (UTC recommended)

2. **Phone Number Format**: Store and validate phone numbers in E.164 format (e.g., +8613800138000)

3. **Distance Calculation**: Use Haversine formula for calculating distances between coordinates

4. **Security**:
   - Implement CORS properly
   - Validate all input data
   - Sanitize user-generated content
   - Use HTTPS only
   - Implement proper authentication and authorization

5. **Caching**: Consider caching frequently accessed data like friend lists, product lists

6. **Database Indexing**: Index fields like:
   - User: phone, id
   - Friend relationships: userId, friendId
   - Location: friendId, timestamp
   - Messages: senderId, receiverId, timestamp

7. **Real-time Updates**: Consider using WebSockets or Server-Sent Events (SSE) for real-time location and health updates

8. **Image Storage**: Use CDN for serving images (avatars, product images)

9. **Error Handling**: Always return consistent error format with appropriate HTTP status codes

10. **API Versioning**: Consider versioning your API (e.g., `/api/v1/...`) for future compatibility

---

## 18. Testing Recommendations

Backend should provide:
- Health check endpoint: `GET /api/health`
- API documentation endpoint (if using OpenAPI/Swagger)
- Test endpoints for development (optional, should be disabled in production)

---

This specification covers all data requirements identified in the React Native application. The backend can be implemented in any language/framework following these specifications.

