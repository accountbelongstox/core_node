# AChat API Endpoints Specification

## Overview
This document provides comprehensive specifications for all 35+ API endpoints required for the AChat enterprise communication application, including detailed request/response formats and data structures.

## Base Configuration
- **Base URL**: `https://api.achat.enterprise.com/v1`
- **Authentication**: Bearer Token (JWT)
- **Content-Type**: `application/json`
- **Rate Limiting**: 1000 requests per minute per user

## 1. Authentication & User Management APIs

### 1.1 User Authentication

#### POST /auth/login
**Purpose**: Authenticate user with credentials
```json
// Request
{
  "email": "user@company.com",
  "password": "securePassword123",
  "device_info": {
    "device_id": "device_uuid",
    "device_name": "iPhone 14 Pro",
    "platform": "ios",
    "app_version": "1.0.0"
  },
  "remember_me": true
}

// Response (200)
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh_token": "refresh_token_string",
    "token_type": "Bearer",
    "expires_in": 3600,
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
      "preferences": {
        "language": "en",
        "timezone": "UTC",
        "notification_settings": {
          "push_enabled": true,
          "email_enabled": false,
          "sound_enabled": true
        }
      }
    }
  }
}
```

#### POST /auth/refresh
**Purpose**: Refresh expired access token
```json
// Request
{
  "refresh_token": "refresh_token_string"
}

// Response (200)
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "new_access_token",
    "expires_in": 3600
  }
}
```

#### POST /auth/logout
**Purpose**: Logout user and invalidate tokens
```json
// Request
{
  "device_id": "device_uuid"
}

// Response (200)
{
  "success": true,
  "message": "Logout successful"
}
```

#### POST /auth/forgot-password
**Purpose**: Initiate password reset process
```json
// Request
{
  "email": "user@company.com"
}

// Response (200)
{
  "success": true,
  "message": "Password reset instructions sent to email"
}
```

### 1.2 User Profile Management

#### GET /users/profile
**Purpose**: Get current user profile
```json
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
    "privacy_settings": {
      "profile_visibility": "company",
      "last_seen_visibility": "contacts",
      "phone_visibility": "department"
    }
  }
}
```

#### PUT /users/profile
**Purpose**: Update user profile information
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
  }
}
```

#### POST /users/avatar
**Purpose**: Upload user avatar image
```json
// Request (multipart/form-data)
{
  "avatar": "image_file"
}

// Response (200)
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "avatar_url": "https://cdn.achat.com/avatars/user_123_new.jpg"
  }
}
```

#### GET /users/qr-code
**Purpose**: Generate QR code for user profile
```json
// Response (200)
{
  "success": true,
  "data": {
    "qr_code_url": "https://cdn.achat.com/qr/user_123.png",
    "qr_data": "achat://profile/user_123",
    "expires_at": "2024-01-16T10:30:00Z"
  }
}
```

## 2. Chat & Messaging APIs

### 2.1 Conversation Management

#### GET /chats
**Purpose**: Get list of conversations
```json
// Query Parameters: ?page=1&per_page=20&search=keyword&filter=unread

// Response (200)
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "chat_456",
        "type": "individual", // individual, group, channel, announcement
        "name": "Alice Johnson",
        "avatar_url": "https://cdn.achat.com/avatars/alice.jpg",
        "participants_count": 2,
        "last_message": {
          "id": "msg_789",
          "content": "Hey, how's the project going?",
          "sender": {
            "id": "user_789",
            "name": "Alice Johnson",
            "avatar_url": "https://cdn.achat.com/avatars/alice.jpg"
          },
          "timestamp": "2024-01-15T10:25:00Z",
          "type": "text"
        },
        "unread_count": 3,
        "is_pinned": false,
        "is_muted": false,
        "is_archived": false,
        "updated_at": "2024-01-15T10:25:00Z",
        "participants": [
          {
            "id": "user_123",
            "name": "John Doe",
            "is_online": true,
            "last_seen": "2024-01-15T10:30:00Z"
          },
          {
            "id": "user_789",
            "name": "Alice Johnson",
            "is_online": false,
            "last_seen": "2024-01-15T10:25:00Z"
          }
        ]
      }
    ],
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
```json
// Request
{
  "type": "individual", // individual, group
  "participants": ["user_789"],
  "name": "Project Discussion", // For groups
  "description": "Discussion about the new mobile app project" // For groups
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
    "created_at": "2024-01-15T11:00:00Z"
  }
}
```

#### GET /chats/{chat_id}
**Purpose**: Get conversation details
```json
// Response (200)
{
  "success": true,
  "data": {
    "id": "chat_456",
    "type": "group",
    "name": "Development Team",
    "description": "Main development team discussion",
    "avatar_url": "https://cdn.achat.com/groups/dev_team.jpg",
    "participants_count": 8,
    "created_by": {
      "id": "user_001",
      "name": "Team Lead"
    },
    "created_at": "2024-01-01T10:00:00Z",
    "settings": {
      "only_admins_can_send": false,
      "allow_file_sharing": true,
      "message_retention_days": 365
    },
    "participants": [
      {
        "id": "user_123",
        "name": "John Doe",
        "role": "member", // admin, member
        "joined_at": "2024-01-01T10:00:00Z",
        "is_online": true,
        "last_seen": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### 2.2 Message Operations

#### GET /chats/{chat_id}/messages
**Purpose**: Get messages from a conversation
```json
// Query Parameters: ?page=1&per_page=50&before=msg_id&after=msg_id

// Response (200)
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_789",
        "chat_id": "chat_456",
        "sender": {
          "id": "user_789",
          "name": "Alice Johnson",
          "avatar_url": "https://cdn.achat.com/avatars/alice.jpg"
        },
        "content": "Hey, how's the project going?",
        "type": "text", // text, image, file, voice, video, system
        "timestamp": "2024-01-15T10:25:00Z",
        "edited_at": null,
        "reply_to": null, // Message ID if this is a reply
        "attachments": [],
        "reactions": [
          {
            "emoji": "👍",
            "count": 2,
            "users": ["user_123", "user_456"]
          }
        ],
        "read_by": [
          {
            "user_id": "user_123",
            "read_at": "2024-01-15T10:26:00Z"
          }
        ],
        "delivery_status": "delivered", // sent, delivered, read
        "is_system_message": false
      },
      {
        "id": "msg_790",
        "chat_id": "chat_456",
        "sender": {
          "id": "user_123",
          "name": "John Doe",
          "avatar_url": "https://cdn.achat.com/avatars/john.jpg"
        },
        "content": "",
        "type": "image",
        "timestamp": "2024-01-15T10:27:00Z",
        "attachments": [
          {
            "id": "att_123",
            "type": "image",
            "url": "https://cdn.achat.com/files/image_123.jpg",
            "thumbnail_url": "https://cdn.achat.com/files/thumb_image_123.jpg",
            "filename": "screenshot.jpg",
            "size": 524288,
            "width": 1920,
            "height": 1080
          }
        ],
        "reactions": [],
        "read_by": [],
        "delivery_status": "sent"
      }
    ],
    "pagination": {
      "current_page": 1,
      "has_next_page": true,
      "has_prev_page": false
    }
  }
}
```

#### POST /chats/{chat_id}/messages
**Purpose**: Send a new message
```json
// Request
{
  "content": "This is a text message",
  "type": "text",
  "reply_to": "msg_456", // Optional: reply to another message
  "attachments": [], // Optional: attachment IDs
  "temporary_id": "temp_msg_123" // Client-generated ID for optimistic updates
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
    "type": "text",
    "timestamp": "2024-01-15T11:00:00Z",
    "temporary_id": "temp_msg_123",
    "delivery_status": "sent"
  }
}
```

#### PUT /messages/{message_id}
**Purpose**: Edit an existing message
```json
// Request
{
  "content": "This is an edited message"
}

// Response (200)
{
  "success": true,
  "message": "Message updated successfully",
  "data": {
    "id": "msg_789",
    "content": "This is an edited message",
    "edited_at": "2024-01-15T11:05:00Z"
  }
}
```

#### DELETE /messages/{message_id}
**Purpose**: Delete a message
```json
// Response (200)
{
  "success": true,
  "message": "Message deleted successfully"
}
```

#### POST /messages/{message_id}/reactions
**Purpose**: Add reaction to a message
```json
// Request
{
  "emoji": "👍"
}

// Response (200)
{
  "success": true,
  "message": "Reaction added successfully",
  "data": {
    "emoji": "👍",
    "count": 3,
    "users": ["user_123", "user_456", "user_789"]
  }
}
```

### 2.3 Message Status & Read Receipts

#### POST /chats/{chat_id}/mark-read
**Purpose**: Mark conversation as read
```json
// Request
{
  "last_read_message_id": "msg_789"
}

// Response (200)
{
  "success": true,
  "message": "Conversation marked as read"
}
```

#### GET /chats/{chat_id}/typing
**Purpose**: Get typing indicators
```json
// Response (200)
{
  "success": true,
  "data": {
    "typing_users": [
      {
        "id": "user_789",
        "name": "Alice Johnson",
        "started_at": "2024-01-15T11:00:00Z"
      }
    ]
  }
}
```

#### POST /chats/{chat_id}/typing
**Purpose**: Send typing indicator
```json
// Request
{
  "is_typing": true
}

// Response (200)
{
  "success": true,
  "message": "Typing status updated"
}
```

## 3. Contact Management APIs

### 3.1 Contact Operations

#### GET /contacts
**Purpose**: Get user's contact list
```json
// Query Parameters: ?search=name&department=engineering&status=online&page=1

// Response (200)
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "user_789",
        "username": "alice.johnson",
        "full_name": "Alice Johnson",
        "email": "alice.johnson@company.com",
        "avatar_url": "https://cdn.achat.com/avatars/alice.jpg",
        "department": "Engineering",
        "position": "Frontend Developer",
        "phone": "+1234567891",
        "is_online": true,
        "last_seen": "2024-01-15T10:25:00Z",
        "status_message": "Working on the mobile app",
        "is_favorite": false,
        "is_blocked": false,
        "added_at": "2024-01-01T10:00:00Z",
        "relationship": "colleague", // colleague, manager, direct_report
        "permissions": {
          "can_chat": true,
          "can_call": true,
          "can_see_profile": true
        }
      }
    ],
    "departments": [
      {
        "name": "Engineering",
        "count": 15
      },
      {
        "name": "Design",
        "count": 8
      }
    ],
    "pagination": {
      "current_page": 1,
      "last_page": 3,
      "per_page": 50,
      "total": 127
    }
  }
}
```

#### POST /contacts
**Purpose**: Add new contact
```json
// Request
{
  "user_id": "user_999",
  "message": "Hi, I'd like to connect with you"
}

// Response (201)
{
  "success": true,
  "message": "Contact request sent successfully",
  "data": {
    "request_id": "req_123",
    "status": "pending",
    "sent_at": "2024-01-15T11:00:00Z"
  }
}
```

#### GET /contacts/requests
**Purpose**: Get pending contact requests
```json
// Response (200)
{
  "success": true,
  "data": {
    "incoming_requests": [
      {
        "id": "req_456",
        "from_user": {
          "id": "user_999",
          "name": "Bob Smith",
          "avatar_url": "https://cdn.achat.com/avatars/bob.jpg",
          "department": "Marketing"
        },
        "message": "Hi, I'd like to connect",
        "sent_at": "2024-01-15T09:00:00Z"
      }
    ],
    "outgoing_requests": [
      {
        "id": "req_789",
        "to_user": {
          "id": "user_888",
          "name": "Carol Davis",
          "avatar_url": "https://cdn.achat.com/avatars/carol.jpg",
          "department": "Design"
        },
        "message": "Let's connect for the project",
        "sent_at": "2024-01-15T08:00:00Z",
        "status": "pending"
      }
    ]
  }
}
```

#### POST /contacts/requests/{request_id}/accept
**Purpose**: Accept contact request
```json
// Response (200)
{
  "success": true,
  "message": "Contact request accepted",
  "data": {
    "contact": {
      // Contact object
    }
  }
}
```

#### POST /contacts/requests/{request_id}/decline
**Purpose**: Decline contact request
```json
// Response (200)
{
  "success": true,
  "message": "Contact request declined"
}
```

### 3.2 Contact Management

#### PUT /contacts/{contact_id}
**Purpose**: Update contact information
```json
// Request
{
  "is_favorite": true,
  "notes": "Great colleague to work with"
}

// Response (200)
{
  "success": true,
  "message": "Contact updated successfully"
}
```

#### POST /contacts/{contact_id}/block
**Purpose**: Block a contact
```json
// Response (200)
{
  "success": true,
  "message": "Contact blocked successfully"
}
```

#### DELETE /contacts/{contact_id}
**Purpose**: Remove a contact
```json
// Response (200)
{
  "success": true,
  "message": "Contact removed successfully"
}
```

## 4. Group Management APIs

### 4.1 Group Operations

#### POST /groups
**Purpose**: Create a new group
```json
// Request
{
  "name": "Project Alpha Team",
  "description": "Discussion group for Project Alpha",
  "participants": ["user_789", "user_456", "user_321"],
  "settings": {
    "only_admins_can_send": false,
    "allow_file_sharing": true,
    "message_retention_days": 365
  }
}

// Response (201)
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "id": "group_123",
    "name": "Project Alpha Team",
    "description": "Discussion group for Project Alpha",
    "avatar_url": null,
    "participants_count": 4,
    "created_by": {
      "id": "user_123",
      "name": "John Doe"
    },
    "created_at": "2024-01-15T11:00:00Z"
  }
}
```

#### PUT /groups/{group_id}
**Purpose**: Update group information
```json
// Request
{
  "name": "Project Alpha Team - Updated",
  "description": "Updated description",
  "settings": {
    "only_admins_can_send": true
  }
}

// Response (200)
{
  "success": true,
  "message": "Group updated successfully"
}
```

#### POST /groups/{group_id}/avatar
**Purpose**: Upload group avatar
```json
// Response (200)
{
  "success": true,
  "message": "Group avatar updated successfully",
  "data": {
    "avatar_url": "https://cdn.achat.com/groups/group_123.jpg"
  }
}
```

### 4.2 Group Membership

#### POST /groups/{group_id}/members
**Purpose**: Add members to group
```json
// Request
{
  "user_ids": ["user_999", "user_888"],
  "role": "member" // admin, member
}

// Response (200)
{
  "success": true,
  "message": "Members added successfully",
  "data": {
    "added_members": [
      {
        "id": "user_999",
        "name": "Bob Smith",
        "role": "member",
        "joined_at": "2024-01-15T11:30:00Z"
      }
    ]
  }
}
```

#### DELETE /groups/{group_id}/members/{user_id}
**Purpose**: Remove member from group
```json
// Response (200)
{
  "success": true,
  "message": "Member removed successfully"
}
```

#### PUT /groups/{group_id}/members/{user_id}/role
**Purpose**: Update member role
```json
// Request
{
  "role": "admin"
}

// Response (200)
{
  "success": true,
  "message": "Member role updated successfully"
}
```

#### POST /groups/{group_id}/leave
**Purpose**: Leave group
```json
// Response (200)
{
  "success": true,
  "message": "Left group successfully"
}
```

## 5. File & Media APIs

### 5.1 File Upload

#### POST /files/upload
**Purpose**: Upload file attachment
```json
// Request (multipart/form-data)
{
  "file": "file_data",
  "type": "image", // image, document, video, audio
  "chat_id": "chat_456" // Optional: associate with chat
}

// Response (200)
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "file_123",
    "url": "https://cdn.achat.com/files/file_123.jpg",
    "thumbnail_url": "https://cdn.achat.com/files/thumb_file_123.jpg",
    "filename": "document.pdf",
    "original_filename": "Project_Requirements.pdf",
    "size": 1048576,
    "type": "document",
    "mime_type": "application/pdf",
    "width": null,
    "height": null,
    "duration": null,
    "uploaded_at": "2024-01-15T11:00:00Z",
    "expires_at": "2024-02-15T11:00:00Z"
  }
}
```

#### GET /files/{file_id}
**Purpose**: Get file information
```json
// Response (200)
{
  "success": true,
  "data": {
    "id": "file_123",
    "url": "https://cdn.achat.com/files/file_123.jpg",
    "filename": "document.pdf",
    "size": 1048576,
    "type": "document",
    "uploaded_by": {
      "id": "user_123",
      "name": "John Doe"
    },
    "uploaded_at": "2024-01-15T11:00:00Z"
  }
}
```

#### DELETE /files/{file_id}
**Purpose**: Delete uploaded file
```json
// Response (200)
{
  "success": true,
  "message": "File deleted successfully"
}
```

## 6. Search APIs

### 6.1 Global Search

#### GET /search
**Purpose**: Search across messages, contacts, and groups
```json
// Query Parameters: ?query=project&type=all&chat_id=chat_456&limit=20

// Response (200)
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "content": "The project deadline is approaching...",
        "chat": {
          "id": "chat_456",
          "name": "Development Team"
        },
        "sender": {
          "id": "user_789",
          "name": "Alice Johnson"
        },
        "timestamp": "2024-01-15T10:00:00Z",
        "highlight": "The <mark>project</mark> deadline is approaching..."
      }
    ],
    "contacts": [
      {
        "id": "user_999",
        "name": "Project Manager Bob",
        "department": "Engineering",
        "highlight": "<mark>Project</mark> Manager Bob"
      }
    ],
    "groups": [
      {
        "id": "group_123",
        "name": "Project Alpha Team",
        "participants_count": 8,
        "highlight": "<mark>Project</mark> Alpha Team"
      }
    ],
    "pagination": {
      "has_more": true,
      "next_offset": 20
    }
  }
}
```

## 7. Notification APIs

### 7.1 Push Notifications

#### POST /notifications/register-device
**Purpose**: Register device for push notifications
```json
// Request
{
  "device_token": "fcm_token_or_apns_token",
  "platform": "ios", // ios, android
  "device_id": "device_uuid"
}

// Response (200)
{
  "success": true,
  "message": "Device registered for notifications"
}
```

#### GET /notifications
**Purpose**: Get notification history
```json
// Query Parameters: ?page=1&per_page=20&unread_only=true

// Response (200)
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_123",
        "type": "message", // message, mention, group_invite, contact_request
        "title": "New message from Alice Johnson",
        "body": "Hey, how's the project going?",
        "data": {
          "chat_id": "chat_456",
          "message_id": "msg_789",
          "sender_id": "user_789"
        },
        "is_read": false,
        "created_at": "2024-01-15T10:25:00Z",
        "read_at": null
      }
    ],
    "unread_count": 5,
    "pagination": {
      "current_page": 1,
      "has_next_page": true
    }
  }
}
```

#### PUT /notifications/{notification_id}/read
**Purpose**: Mark notification as read
```json
// Response (200)
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### POST /notifications/mark-all-read
**Purpose**: Mark all notifications as read
```json
// Response (200)
{
  "success": true,
  "message": "All notifications marked as read"
}
```

## 8. Settings & Configuration APIs

### 8.1 User Preferences

#### GET /settings/preferences
**Purpose**: Get user preferences
```json
// Response (200)
{
  "success": true,
  "data": {
    "language": "en",
    "timezone": "UTC",
    "theme": "light", // light, dark, auto
    "notification_settings": {
      "push_enabled": true,
      "email_enabled": false,
      "sound_enabled": true,
      "vibration_enabled": true,
      "message_preview": true,
      "quiet_hours": {
        "enabled": true,
        "start_time": "22:00",
        "end_time": "08:00"
      }
    },
    "privacy_settings": {
      "last_seen_visibility": "contacts", // everyone, contacts, nobody
      "profile_photo_visibility": "everyone",
      "read_receipts": true,
      "typing_indicators": true
    },
    "chat_settings": {
      "auto_download_photos": true,
      "auto_download_videos": false,
      "auto_download_documents": false,
      "compression_quality": "medium", // low, medium, high
      "font_size": "medium" // small, medium, large
    }
  }
}
```

#### PUT /settings/preferences
**Purpose**: Update user preferences
```json
// Request
{
  "notification_settings": {
    "push_enabled": false,
    "sound_enabled": false
  },
  "privacy_settings": {
    "last_seen_visibility": "nobody"
  }
}

// Response (200)
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

### 8.2 Security Settings

#### GET /settings/security
**Purpose**: Get security settings
```json
// Response (200)
{
  "success": true,
  "data": {
    "two_factor_enabled": false,
    "active_sessions": [
      {
        "id": "session_123",
        "device_name": "iPhone 14 Pro",
        "platform": "ios",
        "ip_address": "192.168.1.100",
        "location": "New York, NY",
        "last_active": "2024-01-15T11:00:00Z",
        "is_current": true
      }
    ],
    "login_history": [
      {
        "timestamp": "2024-01-15T08:00:00Z",
        "device_name": "iPhone 14 Pro",
        "ip_address": "192.168.1.100",
        "location": "New York, NY",
        "success": true
      }
    ]
  }
}
```

#### POST /settings/security/enable-2fa
**Purpose**: Enable two-factor authentication
```json
// Response (200)
{
  "success": true,
  "message": "2FA setup initiated",
  "data": {
    "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "backup_codes": ["123456", "789012", "345678"]
  }
}
```

#### DELETE /settings/security/sessions/{session_id}
**Purpose**: Terminate active session
```json
// Response (200)
{
  "success": true,
  "message": "Session terminated successfully"
}
```

## 9. WebSocket Events

### 9.1 Real-time Event Types

#### Message Events
```json
// New message received
{
  "type": "message_received",
  "data": {
    "chat_id": "chat_456",
    "message": {
      // Complete message object
    }
  }
}

// Message status updated
{
  "type": "message_status_updated",
  "data": {
    "message_id": "msg_789",
    "status": "read",
    "updated_by": "user_456"
  }
}

// Typing indicator
{
  "type": "user_typing",
  "data": {
    "chat_id": "chat_456",
    "user_id": "user_789",
    "is_typing": true
  }
}
```

#### Presence Events
```json
// User online status changed
{
  "type": "user_presence_changed",
  "data": {
    "user_id": "user_789",
    "is_online": true,
    "last_seen": "2024-01-15T11:00:00Z"
  }
}
```

#### Group Events
```json
// Group member added
{
  "type": "group_member_added",
  "data": {
    "group_id": "group_123",
    "member": {
      "id": "user_999",
      "name": "Bob Smith",
      "role": "member"
    },
    "added_by": "user_123"
  }
}
```

## 10. Error Responses

### Standard Error Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field_name": ["Validation error message"]
  },
  "error_code": "VALIDATION_ERROR",
  "meta": {
    "request_id": "req_123456",
    "timestamp": "2024-01-15T11:00:00Z"
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR` (422): Request validation failed
- `UNAUTHORIZED` (401): Invalid or expired token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMITED` (429): Too many requests
- `SERVER_ERROR` (500): Internal server error
- `MAINTENANCE_MODE` (503): Server under maintenance

This comprehensive API specification provides all the necessary endpoints for the AChat enterprise communication application with detailed request/response formats and proper error handling.