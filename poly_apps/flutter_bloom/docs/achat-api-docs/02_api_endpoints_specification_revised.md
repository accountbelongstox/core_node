# AChat API Endpoints Specification (Revised for Common Library Integration)

## Overview
This document provides comprehensive specifications for all 35+ API endpoints required for the AChat enterprise communication application, designed to integrate seamlessly with the Flutter Bloom common library infrastructure.

## Base Configuration & Common Library Integration
- **Base URL**: `https://api.achat.enterprise.com/v1`
- **Authentication**: Bearer Token (JWT) - integrated with `BaseUserProvider`
- **Response Format**: Uses enhanced `ApiResponse<T>` from common library
- **Storage Integration**: Leverages `StorageManager` for caching and offline support
- **Rate Limiting**: 1000 requests per minute per user
- **Cache Headers**: Includes `Cache-Control` and `ETag` for intelligent caching

## Standard Response Wrapper (Enhanced from Common Library)

### Enhanced ApiResponse Format
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}, // Actual response data
  "meta": {
    "request_id": "req_123456",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "v1",
    "cache_info": {
      "cacheable": true,
      "ttl": 300,
      "etag": "abc123"
    }
  },
  "pagination": { // For paginated responses
    "current_page": 1,
    "last_page": 5,
    "per_page": 20,
    "total": 87,
    "has_next_page": true,
    "has_prev_page": false
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "errors": {
    "email": ["Email is required"],
    "password": ["Password must be at least 8 characters"]
  },
  "meta": {
    "request_id": "req_123456",
    "timestamp": "2024-01-15T10:30:00Z",
    "error_code": "VALIDATION_ERROR",
    "retry_after": 60
  }
}
```

## 1. Authentication & User Management APIs

### 1.1 Enhanced Authentication (Integrates with BaseUserProvider)

#### POST /auth/login
**Purpose**: Authenticate user and initialize AChat session
**Cache**: No caching
**Storage**: Stores auth tokens in secure storage
```json
// Request
{
  "email": "user@company.com",
  "password": "securePassword123",
  "device_info": {
    "device_id": "device_uuid",
    "device_name": "iPhone 14 Pro",
    "platform": "ios",
    "app_version": "1.0.0",
    "push_token": "fcm_token_or_apns_token"
  },
  "remember_me": true
}

// Response (200) - Enhanced with AChat-specific data
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "refresh_token_string",
    "token_type": "Bearer",
    "expires_in": 3600,
    "websocket_url": "wss://ws.achat.enterprise.com/v1/ws",
    "user": {
      "id": "user_123",
      "username": "john.doe",
      "email": "john.doe@company.com",
      "full_name": "John Doe",
      "avatar_url": "https://cdn.achat.com/avatars/user_123.jpg",
      "department": "Engineering",
      "position": "Senior Developer",
      "phone": "+1234567890",
      "is_online": true,
      "last_seen": "2024-01-15T10:30:00Z",
      "is_verified": true,
      "permissions": ["chat", "group_create", "contact_add"],
      "presence": {
        "status": "available",
        "message": "Working on mobile app",
        "last_updated": "2024-01-15T10:30:00Z"
      },
      "preferences": {
        "language": "en",
        "timezone": "UTC",
        "theme": "light",
        "notification_settings": {
          "push_enabled": true,
          "email_enabled": false,
          "sound_enabled": true,
          "vibration_enabled": true,
          "quiet_hours": {
            "enabled": true,
            "start_time": "22:00",
            "end_time": "08:00"
          }
        },
        "privacy_settings": {
          "last_seen_visibility": "contacts",
          "profile_photo_visibility": "everyone",
          "read_receipts": true,
          "typing_indicators": true
        }
      }
    },
    "initial_data": {
      "unread_conversations_count": 5,
      "total_contacts": 127,
      "active_groups": 8
    }
  },
  "meta": {
    "request_id": "req_123456",
    "timestamp": "2024-01-15T10:30:00Z",
    "session_id": "sess_789"
  }
}
```

#### POST /auth/refresh
**Purpose**: Refresh expired access token
**Cache**: No caching
**Integration**: Automatic token refresh via auth interceptor
```json
// Request
{
  "refresh_token": "refresh_token_string",
  "device_id": "device_uuid"
}

// Response (200)
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "new_access_token",
    "expires_in": 3600,
    "websocket_reconnect": true
  },
  "meta": {
    "request_id": "req_123457",
    "timestamp": "2024-01-15T11:30:00Z"
  }
}
```

### 1.2 User Profile Management (Cached Responses)

#### GET /users/profile
**Purpose**: Get current user profile
**Cache**: 5 minutes TTL
**Storage**: Cached in user_profile key
```json
// Headers
Cache-Control: max-age=300
ETag: "profile_abc123"

// Response (200)
{
  "success": true,
  "data": {
    "id": "user_123",
    "username": "john.doe",
    "email": "john.doe@company.com",
    "full_name": "John Doe",
    "avatar_url": "https://cdn.achat.com/avatars/user_123.jpg",
    "bio": "Senior Developer passionate about mobile apps",
    "department": "Engineering",
    "position": "Senior Developer",
    "phone": "+1234567890",
    "created_at": "2023-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "is_verified": true,
    "is_online": true,
    "last_seen": "2024-01-15T10:30:00Z",
    "status_message": "Available for chat",
    "presence": {
      "status": "available",
      "message": "Working on mobile app",
      "last_updated": "2024-01-15T10:30:00Z"
    },
    "privacy_settings": {
      "profile_visibility": "company",
      "last_seen_visibility": "contacts",
      "phone_visibility": "department"
    },
    "statistics": {
      "total_messages_sent": 1250,
      "total_conversations": 45,
      "days_active": 123
    }
  },
  "meta": {
    "request_id": "req_123458",
    "timestamp": "2024-01-15T10:30:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 300,
      "etag": "profile_abc123"
    }
  }
}
```

#### PUT /users/profile
**Purpose**: Update user profile information
**Cache**: Invalidates profile cache
**Storage**: Updates cached profile data
```json
// Request
{
  "full_name": "John Doe Jr.",
  "bio": "Updated bio text",
  "status_message": "In a meeting",
  "privacy_settings": {
    "profile_visibility": "company",
    "last_seen_visibility": "contacts",
    "phone_visibility": "department"
  }
}

// Response (200)
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    // Updated user object
  },
  "meta": {
    "request_id": "req_123459",
    "timestamp": "2024-01-15T10:35:00Z",
    "cache_invalidated": ["user_profile", "contacts_*"]
  }
}
```

## 2. Chat & Messaging APIs (Enhanced with Real-time Support)

### 2.1 Conversation Management

#### GET /chats
**Purpose**: Get list of conversations with intelligent caching
**Cache**: 2 minutes TTL
**Storage**: Cached conversations list
**Real-time**: WebSocket updates invalidate cache
```json
// Query Parameters: ?page=1&per_page=20&search=keyword&filter=unread&last_activity_after=timestamp

// Headers
Cache-Control: max-age=120
ETag: "chats_def456"

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "chat_456",
      "type": "individual",
      "name": "Alice Johnson",
      "avatar_url": "https://cdn.achat.com/avatars/alice.jpg",
      "participants_count": 2,
      "last_message": {
        "id": "msg_789",
        "content": "Hey, how's the project going?",
        "content_preview": "Hey, how's the project going?", // Truncated for lists
        "sender": {
          "id": "user_789",
          "name": "Alice Johnson",
          "avatar_url": "https://cdn.achat.com/avatars/alice.jpg"
        },
        "timestamp": "2024-01-15T10:25:00Z",
        "type": "text",
        "is_encrypted": false
      },
      "unread_count": 3,
      "is_pinned": false,
      "is_muted": false,
      "is_archived": false,
      "updated_at": "2024-01-15T10:25:00Z",
      "last_read_message_id": "msg_786",
      "participants": [
        {
          "id": "user_123",
          "name": "John Doe",
          "is_online": true,
          "last_seen": "2024-01-15T10:30:00Z",
          "presence": {
            "status": "available",
            "message": "Online"
          }
        },
        {
          "id": "user_789",
          "name": "Alice Johnson",
          "is_online": false,
          "last_seen": "2024-01-15T10:25:00Z",
          "presence": {
            "status": "away",
            "message": "In a meeting"
          }
        }
      ],
      "typing_users": [], // Real-time typing indicators
      "permissions": {
        "can_send_messages": true,
        "can_add_participants": false,
        "can_leave": true
      }
    }
  ],
  "meta": {
    "request_id": "req_123460",
    "timestamp": "2024-01-15T10:30:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 120,
      "etag": "chats_def456"
    },
    "pagination": {
      "current_page": 1,
      "last_page": 5,
      "per_page": 20,
      "total": 87,
      "has_next_page": true,
      "has_prev_page": false
    }
  }
}
```

#### POST /chats
**Purpose**: Create new conversation
**Cache**: Invalidates chat list cache
**Storage**: Adds to local conversations
**Real-time**: Broadcasts to participants
```json
// Request
{
  "type": "individual", // individual, group
  "participants": ["user_789"],
  "name": "Project Discussion", // For groups
  "description": "Discussion about the new mobile app project", // For groups
  "initial_message": {
    "content": "Hi! Let's discuss the project timeline.",
    "type": "text"
  }
}

// Response (201)
{
  "success": true,
  "message": "Conversation created successfully",
  "data": {
    "id": "chat_new_123",
    "type": "individual",
    "name": "Alice Johnson",
    "participants": [
      // participant objects
    ],
    "created_at": "2024-01-15T11:00:00Z",
    "websocket_room": "chat_new_123"
  },
  "meta": {
    "request_id": "req_123461",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_invalidated": ["chats_*"],
    "realtime_event": {
      "type": "conversation_created",
      "broadcast_to": ["user_789"]
    }
  }
}
```

### 2.2 Message Operations (Enhanced with Encryption Support)

#### GET /chats/{chat_id}/messages
**Purpose**: Get messages with offline support
**Cache**: 5 minutes TTL per page
**Storage**: Messages stored locally for offline access
```json
// Query Parameters: ?page=1&per_page=50&before=msg_id&after=msg_id&include_encrypted=true

// Headers
Cache-Control: max-age=300
ETag: "messages_ghi789"

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "msg_789",
      "chat_id": "chat_456",
      "sender": {
        "id": "user_789",
        "name": "Alice Johnson",
        "avatar_url": "https://cdn.achat.com/avatars/alice.jpg"
      },
      "content": "Hey, how's the project going?",
      "content_encrypted": false,
      "type": "text",
      "timestamp": "2024-01-15T10:25:00Z",
      "edited_at": null,
      "reply_to": null,
      "attachments": [],
      "reactions": [
        {
          "emoji": "👍",
          "count": 2,
          "users": [
            {
              "id": "user_123",
              "name": "John Doe"
            }
          ],
          "user_reacted": true
        }
      ],
      "read_by": [
        {
          "user_id": "user_123",
          "read_at": "2024-01-15T10:26:00Z"
        }
      ],
      "delivery_status": "read", // sent, delivered, read
      "is_system_message": false,
      "metadata": {
        "client_id": "temp_msg_123", // For optimistic updates
        "encryption_version": null,
        "edit_history": []
      }
    },
    {
      "id": "msg_790",
      "chat_id": "chat_456",
      "sender": {
        "id": "user_123",
        "name": "John Doe",
        "avatar_url": "https://cdn.achat.com/avatars/john.jpg"
      },
      "content": "", // Empty for media messages
      "content_encrypted": false,
      "type": "image",
      "timestamp": "2024-01-15T10:27:00Z",
      "attachments": [
        {
          "id": "att_123",
          "type": "image",
          "url": "https://cdn.achat.com/files/image_123.jpg",
          "thumbnail_url": "https://cdn.achat.com/files/thumb_image_123.jpg",
          "filename": "screenshot.jpg",
          "original_filename": "Screenshot_20240115.jpg",
          "size": 524288,
          "width": 1920,
          "height": 1080,
          "mime_type": "image/jpeg",
          "download_url": "https://cdn.achat.com/files/download/image_123.jpg?token=abc123",
          "expires_at": "2024-01-16T10:27:00Z",
          "processing_status": "completed" // uploading, processing, completed, failed
        }
      ],
      "reactions": [],
      "read_by": [],
      "delivery_status": "sent"
    }
  ],
  "meta": {
    "request_id": "req_123462",
    "timestamp": "2024-01-15T10:30:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 300,
      "etag": "messages_ghi789"
    },
    "pagination": {
      "current_page": 1,
      "has_next_page": true,
      "has_prev_page": false,
      "total_messages": 245,
      "oldest_message_id": "msg_001",
      "newest_message_id": "msg_790"
    }
  }
}
```

#### POST /chats/{chat_id}/messages
**Purpose**: Send message with encryption support and optimistic updates
**Cache**: Invalidates conversation cache
**Storage**: Immediately stores with pending status
**Real-time**: Broadcasts via WebSocket
```json
// Request
{
  "content": "This is a text message",
  "type": "text",
  "reply_to": "msg_456", // Optional
  "attachments": [], // File IDs from upload
  "client_id": "temp_msg_123", // For optimistic updates
  "encrypt": false, // Whether to encrypt content
  "metadata": {
    "mentions": ["user_789"],
    "rich_text": {
      "bold": [[0, 4]], // Text formatting ranges
      "italic": [[8, 12]]
    }
  }
}

// Response (201)
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": "msg_new_123",
    "chat_id": "chat_456",
    "sender": {
      "id": "user_123",
      "name": "John Doe",
      "avatar_url": "https://cdn.achat.com/avatars/john.jpg"
    },
    "content": "This is a text message",
    "content_encrypted": false,
    "type": "text",
    "timestamp": "2024-01-15T11:00:00Z",
    "client_id": "temp_msg_123",
    "delivery_status": "sent",
    "mentions": ["user_789"]
  },
  "meta": {
    "request_id": "req_123463",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_invalidated": ["chats_*", "messages_chat_456_*"],
    "realtime_event": {
      "type": "message_sent",
      "broadcast_to": "chat_456",
      "notification_users": ["user_789"]
    }
  }
}
```

#### PUT /messages/{message_id}
**Purpose**: Edit message with history tracking
**Cache**: Invalidates message cache
**Real-time**: Broadcasts edit event
```json
// Request
{
  "content": "This is an edited message",
  "edit_reason": "Fixed typo" // Optional
}

// Response (200)
{
  "success": true,
  "message": "Message updated successfully",
  "data": {
    "id": "msg_789",
    "content": "This is an edited message",
    "edited_at": "2024-01-15T11:05:00Z",
    "edit_history": [
      {
        "previous_content": "This is a text message",
        "edited_at": "2024-01-15T11:05:00Z",
        "edited_by": "user_123",
        "edit_reason": "Fixed typo"
      }
    ]
  },
  "meta": {
    "request_id": "req_123464",
    "timestamp": "2024-01-15T11:05:00Z",
    "cache_invalidated": ["messages_*"],
    "realtime_event": {
      "type": "message_edited",
      "broadcast_to": "chat_456"
    }
  }
}
```

### 2.3 Real-time Features

#### POST /chats/{chat_id}/typing
**Purpose**: Send typing indicator (also via WebSocket)
**Cache**: No caching
**Real-time**: Immediate WebSocket broadcast
```json
// Request
{
  "is_typing": true,
  "typing_timeout": 5000 // Auto-stop after 5 seconds
}

// Response (200)
{
  "success": true,
  "message": "Typing status updated",
  "meta": {
    "request_id": "req_123465",
    "timestamp": "2024-01-15T11:00:00Z",
    "realtime_event": {
      "type": "user_typing",
      "broadcast_to": "chat_456",
      "expires_in": 5000
    }
  }
}
```

#### POST /chats/{chat_id}/mark-read
**Purpose**: Mark conversation as read with batch support
**Cache**: Updates conversation unread count
**Storage**: Updates local read status
```json
// Request
{
  "last_read_message_id": "msg_789",
  "read_all": true, // Mark all messages as read
  "read_timestamp": "2024-01-15T11:00:00Z"
}

// Response (200)
{
  "success": true,
  "message": "Conversation marked as read",
  "data": {
    "messages_marked_read": 3,
    "total_unread_conversations": 4
  },
  "meta": {
    "request_id": "req_123466",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_invalidated": ["chats_*"],
    "realtime_event": {
      "type": "messages_read",
      "broadcast_to": "chat_456"
    }
  }
}
```

## 3. WebSocket Events Specification

### 3.1 Connection Management

#### WebSocket URL
```
wss://ws.achat.enterprise.com/v1/ws?token={jwt_token}&client_id={device_id}
```

#### Connection Events
```json
// Client -> Server: Heartbeat
{
  "type": "ping",
  "timestamp": "2024-01-15T11:00:00Z",
  "client_id": "device_uuid"
}

// Server -> Client: Heartbeat Response
{
  "type": "pong",
  "timestamp": "2024-01-15T11:00:00Z",
  "server_time": "2024-01-15T11:00:01Z"
}

// Server -> Client: Connection Established
{
  "type": "connected",
  "data": {
    "session_id": "ws_session_123",
    "server_version": "1.0.0",
    "features": ["typing_indicators", "presence", "encryption"]
  }
}
```

### 3.2 Message Events

#### Real-time Message Reception
```json
// Server -> Client: New Message
{
  "type": "message_received",
  "data": {
    "chat_id": "chat_456",
    "message": {
      // Complete message object from API
    },
    "sender_typing_stopped": true
  },
  "meta": {
    "event_id": "evt_123",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}

// Server -> Client: Message Status Update
{
  "type": "message_status_updated",
  "data": {
    "message_id": "msg_789",
    "chat_id": "chat_456",
    "status": "read",
    "updated_by": "user_456",
    "timestamp": "2024-01-15T11:01:00Z"
  }
}

// Server -> Client: Typing Indicator
{
  "type": "user_typing",
  "data": {
    "chat_id": "chat_456",
    "user": {
      "id": "user_789",
      "name": "Alice Johnson"
    },
    "is_typing": true,
    "expires_at": "2024-01-15T11:00:05Z"
  }
}
```

### 3.3 Presence Events

#### User Presence Updates
```json
// Server -> Client: Presence Change
{
  "type": "user_presence_changed",
  "data": {
    "user_id": "user_789",
    "presence": {
      "status": "busy", // available, busy, away, offline
      "message": "In a meeting",
      "last_seen": "2024-01-15T11:00:00Z"
    },
    "is_online": false
  }
}

// Client -> Server: Update Own Presence
{
  "type": "presence_update",
  "data": {
    "status": "available",
    "message": "Working on mobile app"
  }
}
```

### 3.4 Group Events

#### Group Management Events
```json
// Server -> Client: Group Member Added
{
  "type": "group_member_added",
  "data": {
    "group_id": "group_123",
    "member": {
      "id": "user_999",
      "name": "Bob Smith",
      "role": "member",
      "added_by": "user_123",
      "added_at": "2024-01-15T11:00:00Z"
    }
  }
}

// Server -> Client: Group Updated
{
  "type": "group_updated",
  "data": {
    "group_id": "group_123",
    "changes": {
      "name": "Updated Group Name",
      "description": "New description"
    },
    "updated_by": "user_123"
  }
}
```

## 4. File & Media APIs (Enhanced with Progress Tracking)

### 4.1 File Upload with Progress

#### POST /files/upload
**Purpose**: Upload file with real-time progress
**Cache**: No caching
**Storage**: Stores file metadata
```json
// Request (multipart/form-data)
{
  "file": "file_data",
  "type": "image", // image, document, video, audio
  "chat_id": "chat_456", // Optional: associate with chat
  "compress": true, // Auto-compress images/videos
  "encrypt": false, // Encrypt file content
  "thumbnail_size": "medium" // For images: small, medium, large
}

// Response (200) - Immediate response with upload ID
{
  "success": true,
  "message": "File upload initiated",
  "data": {
    "upload_id": "upload_123",
    "file_id": "file_123", // Final file ID (same as upload_id)
    "upload_url": "https://cdn.achat.com/upload/file_123",
    "status": "uploading",
    "progress": 0,
    "estimated_completion": "2024-01-15T11:02:00Z"
  },
  "meta": {
    "request_id": "req_123467",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}

// WebSocket Progress Updates
{
  "type": "file_upload_progress",
  "data": {
    "upload_id": "upload_123",
    "progress": 65, // Percentage
    "bytes_uploaded": 671744,
    "total_bytes": 1048576,
    "speed_mbps": 2.5,
    "estimated_remaining": "00:00:15"
  }
}

// WebSocket Completion
{
  "type": "file_upload_completed",
  "data": {
    "upload_id": "upload_123",
    "file": {
      "id": "file_123",
      "url": "https://cdn.achat.com/files/file_123.jpg",
      "thumbnail_url": "https://cdn.achat.com/files/thumb_file_123.jpg",
      "filename": "document.pdf",
      "original_filename": "Project_Requirements.pdf",
      "size": 1048576,
      "type": "document",
      "mime_type": "application/pdf",
      "width": 1920, // For images
      "height": 1080, // For images
      "duration": null, // For audio/video
      "encryption_key": null, // If encrypted
      "uploaded_at": "2024-01-15T11:01:30Z"
    }
  }
}
```

#### GET /files/{file_id}/download
**Purpose**: Download file with authentication
**Cache**: 1 hour TTL for download URLs
```json
// Response (200)
{
  "success": true,
  "data": {
    "download_url": "https://cdn.achat.com/files/download/file_123.pdf?token=xyz789&expires=1642248000",
    "expires_at": "2024-01-15T12:00:00Z",
    "file_info": {
      "filename": "Project_Requirements.pdf",
      "size": 1048576,
      "mime_type": "application/pdf",
      "virus_scan_status": "clean" // scanning, clean, infected
    }
  },
  "meta": {
    "request_id": "req_123468",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 3600
    }
  }
}
```

## 5. Search APIs (Enhanced with Caching)

### 5.1 Global Search with Intelligent Caching

#### GET /search
**Purpose**: Search across messages, contacts, and groups
**Cache**: 1 minute TTL per search query
**Storage**: Recent searches cached locally
```json
// Query Parameters: ?query=project&type=all&chat_id=chat_456&limit=20&offset=0&date_from=2024-01-01&date_to=2024-01-15

// Headers
Cache-Control: max-age=60
ETag: "search_jkl012"

// Response (200)
{
  "success": true,
  "data": {
    "query": "project",
    "total_results": 85,
    "search_time_ms": 45,
    "results": {
      "messages": [
        {
          "id": "msg_123",
          "content": "The project deadline is approaching...",
          "content_highlighted": "The <mark>project</mark> deadline is approaching...",
          "chat": {
            "id": "chat_456",
            "name": "Development Team",
            "type": "group"
          },
          "sender": {
            "id": "user_789",
            "name": "Alice Johnson",
            "avatar_url": "https://cdn.achat.com/avatars/alice.jpg"
          },
          "timestamp": "2024-01-15T10:00:00Z",
          "message_context": {
            "previous_message": "We need to discuss the timeline...",
            "next_message": "I think we should meet tomorrow."
          },
          "relevance_score": 0.95
        }
      ],
      "contacts": [
        {
          "id": "user_999",
          "name": "Project Manager Bob",
          "name_highlighted": "<mark>Project</mark> Manager Bob",
          "department": "Engineering",
          "position": "Project Manager",
          "avatar_url": "https://cdn.achat.com/avatars/bob.jpg",
          "is_online": true,
          "relevance_score": 0.88
        }
      ],
      "groups": [
        {
          "id": "group_123",
          "name": "Project Alpha Team",
          "name_highlighted": "<mark>Project</mark> Alpha Team",
          "description": "Team working on Project Alpha",
          "participants_count": 8,
          "avatar_url": "https://cdn.achat.com/groups/project_alpha.jpg",
          "last_activity": "2024-01-15T10:30:00Z",
          "relevance_score": 0.92
        }
      ],
      "files": [
        {
          "id": "file_456",
          "filename": "project_requirements.pdf",
          "filename_highlighted": "<mark>project</mark>_requirements.pdf",
          "type": "document",
          "size": 2048576,
          "uploaded_by": {
            "id": "user_123",
            "name": "John Doe"
          },
          "uploaded_at": "2024-01-10T14:30:00Z",
          "chat_id": "chat_456",
          "relevance_score": 0.85
        }
      ]
    },
    "suggestions": [
      "project management",
      "project timeline",
      "project requirements"
    ],
    "filters_applied": {
      "type": "all",
      "date_range": "2024-01-01 to 2024-01-15",
      "chat_id": null
    }
  },
  "meta": {
    "request_id": "req_123469",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 60,
      "etag": "search_jkl012"
    },
    "pagination": {
      "current_offset": 0,
      "limit": 20,
      "total_results": 85,
      "has_more": true,
      "next_offset": 20
    }
  }
}
```

## 6. Notification APIs (Enhanced with Device Management)

### 6.1 Push Notification Management

#### POST /notifications/register-device
**Purpose**: Register device for push notifications
**Cache**: No caching
**Storage**: Updates device registry
```json
// Request
{
  "device_token": "fcm_token_or_apns_token",
  "platform": "ios", // ios, android, web
  "device_id": "device_uuid",
  "device_info": {
    "name": "iPhone 14 Pro",
    "os_version": "17.0",
    "app_version": "1.0.0"
  },
  "notification_preferences": {
    "message_notifications": true,
    "group_notifications": true,
    "mention_notifications": true,
    "sound_enabled": true,
    "vibration_enabled": true
  }
}

// Response (200)
{
  "success": true,
  "message": "Device registered for notifications",
  "data": {
    "device_registration_id": "reg_123",
    "push_enabled": true,
    "test_notification_sent": true
  },
  "meta": {
    "request_id": "req_123470",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

#### GET /notifications
**Purpose**: Get notification history with filtering
**Cache**: 30 seconds TTL
**Storage**: Recent notifications cached locally
```json
// Query Parameters: ?page=1&per_page=20&unread_only=true&type=message&date_from=2024-01-01

// Response (200)
{
  "success": true,
  "data": [
    {
      "id": "notif_123",
      "type": "message", // message, mention, group_invite, contact_request, system
      "title": "New message from Alice Johnson",
      "body": "Hey, how's the project going?",
      "icon": "https://cdn.achat.com/avatars/alice.jpg",
      "data": {
        "chat_id": "chat_456",
        "message_id": "msg_789",
        "sender_id": "user_789",
        "action_url": "achat://chat/chat_456"
      },
      "is_read": false,
      "created_at": "2024-01-15T10:25:00Z",
      "read_at": null,
      "delivery_status": "delivered", // sent, delivered, failed
      "platforms_sent": ["ios", "web"],
      "priority": "high" // low, normal, high
    }
  ],
  "meta": {
    "request_id": "req_123471",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 30
    },
    "summary": {
      "total_notifications": 156,
      "unread_count": 12,
      "types": {
        "message": 8,
        "mention": 2,
        "group_invite": 1,
        "system": 1
      }
    },
    "pagination": {
      "current_page": 1,
      "has_next_page": true,
      "total": 156
    }
  }
}
```

## 7. Settings & Configuration APIs (Enhanced with Sync)

### 7.1 User Preferences with Cloud Sync

#### GET /settings/preferences
**Purpose**: Get user preferences with device sync
**Cache**: 10 minutes TTL
**Storage**: Preferences cached and synced across devices
```json
// Response (200)
{
  "success": true,
  "data": {
    "user_id": "user_123",
    "preferences": {
      "appearance": {
        "theme": "light", // light, dark, auto
        "language": "en",
        "font_size": "medium", // small, medium, large
        "compact_mode": false,
        "chat_bubble_style": "modern" // classic, modern, minimal
      },
      "notifications": {
        "push_enabled": true,
        "email_enabled": false,
        "sound_enabled": true,
        "vibration_enabled": true,
        "message_preview": true,
        "quiet_hours": {
          "enabled": true,
          "start_time": "22:00",
          "end_time": "08:00",
          "timezone": "UTC"
        },
        "per_chat_settings": {
          "chat_456": {
            "muted": false,
            "sound": "default"
          }
        }
      },
      "privacy": {
        "last_seen_visibility": "contacts", // everyone, contacts, nobody
        "profile_photo_visibility": "everyone",
        "read_receipts": true,
        "typing_indicators": true,
        "online_status": true,
        "message_forwarding_allowed": true
      },
      "chat": {
        "auto_download_photos": true,
        "auto_download_videos": false,
        "auto_download_documents": false,
        "compression_quality": "medium", // low, medium, high
        "message_retention_days": 365,
        "backup_to_cloud": true
      },
      "security": {
        "two_factor_enabled": false,
        "biometric_unlock": true,
        "app_lock_timeout": 300, // seconds
        "screenshot_security": false,
        "incognito_keyboard": false
      },
      "advanced": {
        "developer_mode": false,
        "debug_logging": false,
        "beta_features": false,
        "data_usage_tracking": true
      }
    },
    "sync_info": {
      "last_synced": "2024-01-15T10:30:00Z",
      "sync_version": 5,
      "conflicts": []
    }
  },
  "meta": {
    "request_id": "req_123472",
    "timestamp": "2024-01-15T11:00:00Z",
    "cache_info": {
      "cacheable": true,
      "ttl": 600
    }
  }
}
```

#### PUT /settings/preferences
**Purpose**: Update preferences with conflict resolution
**Cache**: Invalidates preferences cache
**Storage**: Updates local preferences immediately
```json
// Request
{
  "preferences": {
    "notifications": {
      "push_enabled": false,
      "sound_enabled": false
    },
    "privacy": {
      "last_seen_visibility": "nobody"
    }
  },
  "sync_version": 5, // For conflict detection
  "device_id": "device_uuid"
}

// Response (200)
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    "updated_preferences": {
      // Updated preference sections
    },
    "sync_info": {
      "new_sync_version": 6,
      "conflicts_resolved": [],
      "synced_to_devices": ["device_abc", "device_xyz"]
    }
  },
  "meta": {
    "request_id": "req_123473",
    "timestamp": "2024-01-15T11:05:00Z",
    "cache_invalidated": ["settings_preferences"]
  }
}
```

## 8. Offline Support & Synchronization

### 8.1 Offline Queue Management

#### GET /sync/status
**Purpose**: Get synchronization status
**Cache**: No caching
```json
// Response (200)
{
  "success": true,
  "data": {
    "sync_status": "connected", // connected, syncing, offline, error
    "last_sync": "2024-01-15T10:58:00Z",
    "pending_operations": 3,
    "queue_info": {
      "pending_messages": 2,
      "pending_reads": 1,
      "pending_uploads": 0,
      "pending_preference_updates": 0
    },
    "conflict_resolution": {
      "conflicts_detected": 0,
      "auto_resolved": 5,
      "manual_resolution_required": 0
    }
  },
  "meta": {
    "request_id": "req_123474",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

#### POST /sync/execute
**Purpose**: Execute offline operation queue
**Cache**: No caching
```json
// Request
{
  "operations": [
    {
      "id": "op_001",
      "type": "send_message",
      "data": {
        "chat_id": "chat_456",
        "content": "Message sent while offline",
        "client_timestamp": "2024-01-15T10:45:00Z"
      }
    },
    {
      "id": "op_002",
      "type": "mark_read",
      "data": {
        "chat_id": "chat_456",
        "message_id": "msg_788"
      }
    }
  ],
  "client_timestamp": "2024-01-15T11:00:00Z"
}

// Response (200)
{
  "success": true,
  "message": "Sync operations processed",
  "data": {
    "processed_operations": 2,
    "successful_operations": 2,
    "failed_operations": 0,
    "operation_results": [
      {
        "operation_id": "op_001",
        "status": "success",
        "server_message_id": "msg_791",
        "timestamp": "2024-01-15T11:00:30Z"
      },
      {
        "operation_id": "op_002",
        "status": "success",
        "timestamp": "2024-01-15T11:00:31Z"
      }
    ]
  },
  "meta": {
    "request_id": "req_123475",
    "timestamp": "2024-01-15T11:00:30Z"
  }
}
```

## 9. Cache Management Headers

### 9.1 HTTP Cache Headers
All cacheable endpoints include these headers:
```
Cache-Control: max-age=300, must-revalidate
ETag: "resource_version_hash"
Last-Modified: "2024-01-15T10:30:00Z"
Expires: "2024-01-15T10:35:00Z"
Vary: "Authorization, Accept-Language"
```

### 9.2 Cache Invalidation Events
Real-time cache invalidation via WebSocket:
```json
{
  "type": "cache_invalidated",
  "data": {
    "cache_keys": [
      "chats_*",
      "messages_chat_456_*",
      "user_profile"
    ],
    "reason": "message_sent",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

## 10. Error Codes & Status Mapping

### Common Error Codes
- `VALIDATION_ERROR` (422): Request validation failed
- `UNAUTHORIZED` (401): Invalid or expired token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMITED` (429): Too many requests
- `SERVER_ERROR` (500): Internal server error
- `MAINTENANCE_MODE` (503): Server under maintenance
- `CONFLICT` (409): Resource conflict (e.g., duplicate message)
- `PAYLOAD_TOO_LARGE` (413): File too large
- `UPGRADE_REQUIRED` (426): Client version too old

### Integration with Common Library Response Handling
All errors are automatically handled by the extended `ApiClient` and converted to appropriate `ApiException` instances for consistent error handling across the application.

This enhanced API specification provides comprehensive integration with the Flutter Bloom common library while adding the advanced features needed for AChat's enterprise communication requirements.