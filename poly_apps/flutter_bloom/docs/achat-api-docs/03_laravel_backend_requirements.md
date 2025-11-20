# Laravel Backend Requirements for AChat Enterprise Communication

## Overview
This document outlines comprehensive Laravel backend requirements for the AChat enterprise communication application, including database design, API controllers, middleware, services, and deployment specifications.

## 1. Project Architecture

### 1.1 Laravel Framework Setup
```
app/
├── Console/
├── Exceptions/
├── Http/
│   ├── Controllers/
│   │   └── Api/
│   │       └── V1/
│   │           ├── Auth/
│   │           ├── Chat/
│   │           ├── Contact/
│   │           ├── Group/
│   │           ├── File/
│   │           ├── Notification/
│   │           ├── Search/
│   │           └── Setting/
│   ├── Middleware/
│   ├── Requests/
│   │   └── Api/
│   │       └── V1/
│   └── Resources/
│       └── Api/
│           └── V1/
├── Models/
├── Providers/
├── Services/
│   ├── AuthService/
│   ├── ChatService/
│   ├── NotificationService/
│   ├── FileService/
│   └── WebSocketService/
└── Jobs/
    ├── SendNotificationJob/
    ├── ProcessMessageJob/
    └── BroadcastEventJob/
```

### 1.2 Required Laravel Packages
```json
{
  "dependencies": {
    "laravel/framework": "^10.0",
    "laravel/sanctum": "^3.0",
    "pusher/pusher-php-server": "^7.0",
    "laravel/horizon": "^5.0",
    "predis/predis": "^2.0",
    "league/flysystem-aws-s3-v3": "^3.0",
    "intervention/image": "^2.7",
    "spatie/laravel-permission": "^5.0",
    "laravel/telescope": "^4.0",
    "barryvdh/laravel-cors": "^2.0",
    "tymon/jwt-auth": "^2.0",
    "laravel/scout": "^9.0",
    "meilisearch/meilisearch-php": "^1.0"
  }
}
```

## 2. Database Schema Design

### 2.1 Core User Tables

#### users
```sql
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    bio TEXT NULL,
    phone VARCHAR(20) NULL,
    department VARCHAR(100) NULL,
    position VARCHAR(100) NULL,
    status_message VARCHAR(255) NULL,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255) NULL,
    remember_token VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_department (department),
    INDEX idx_is_online (is_online),
    INDEX idx_last_seen (last_seen)
);
```

#### user_devices
```sql
CREATE TABLE user_devices (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    platform ENUM('ios', 'android', 'web') NOT NULL,
    push_token VARCHAR(500) NULL,
    app_version VARCHAR(20) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_active TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_device (user_id, device_id),
    INDEX idx_user_id (user_id),
    INDEX idx_device_id (device_id),
    INDEX idx_push_token (push_token)
);
```

### 2.2 Chat & Messaging Tables

#### chats
```sql
CREATE TABLE chats (
    id CHAR(36) PRIMARY KEY,
    type ENUM('individual', 'group', 'channel', 'announcement') NOT NULL,
    name VARCHAR(255) NULL,
    description TEXT NULL,
    avatar_url VARCHAR(500) NULL,
    created_by CHAR(36) NULL,
    last_message_id CHAR(36) NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    participants_count INT DEFAULT 0,
    settings JSON NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_type (type),
    INDEX idx_created_by (created_by),
    INDEX idx_last_activity (last_activity),
    INDEX idx_participants_count (participants_count)
);
```

#### chat_participants
```sql
CREATE TABLE chat_participants (
    id CHAR(36) PRIMARY KEY,
    chat_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_message_id CHAR(36) NULL,
    last_read_at TIMESTAMP NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    notification_settings JSON NULL,
    left_at TIMESTAMP NULL,

    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_chat_user (chat_id, user_id, left_at),
    INDEX idx_chat_id (chat_id),
    INDEX idx_user_id (user_id),
    INDEX idx_role (role)
);
```

#### messages
```sql
CREATE TABLE messages (
    id CHAR(36) PRIMARY KEY,
    chat_id CHAR(36) NOT NULL,
    sender_id CHAR(36) NOT NULL,
    reply_to_id CHAR(36) NULL,
    content TEXT NULL,
    type ENUM('text', 'image', 'file', 'voice', 'video', 'system') NOT NULL,
    metadata JSON NULL,
    is_system_message BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_chat_id (chat_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_created_at (created_at),
    INDEX idx_type (type),
    INDEX idx_reply_to_id (reply_to_id),
    FULLTEXT idx_content (content)
);
```

#### message_attachments
```sql
CREATE TABLE message_attachments (
    id CHAR(36) PRIMARY KEY,
    message_id CHAR(36) NOT NULL,
    file_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    INDEX idx_message_id (message_id),
    INDEX idx_file_id (file_id)
);
```

#### message_reactions
```sql
CREATE TABLE message_reactions (
    id CHAR(36) PRIMARY KEY,
    message_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_user_emoji (message_id, user_id, emoji),
    INDEX idx_message_id (message_id),
    INDEX idx_user_id (user_id),
    INDEX idx_emoji (emoji)
);
```

#### message_read_receipts
```sql
CREATE TABLE message_read_receipts (
    id CHAR(36) PRIMARY KEY,
    message_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_user (message_id, user_id),
    INDEX idx_message_id (message_id),
    INDEX idx_user_id (user_id),
    INDEX idx_read_at (read_at)
);
```

### 2.3 Contact & Relationship Tables

#### contacts
```sql
CREATE TABLE contacts (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    contact_user_id CHAR(36) NOT NULL,
    relationship_type ENUM('colleague', 'manager', 'direct_report', 'external') DEFAULT 'colleague',
    is_favorite BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    notes TEXT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_contact (user_id, contact_user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_contact_user_id (contact_user_id),
    INDEX idx_relationship_type (relationship_type),
    INDEX idx_is_favorite (is_favorite),
    INDEX idx_is_blocked (is_blocked)
);
```

#### contact_requests
```sql
CREATE TABLE contact_requests (
    id CHAR(36) PRIMARY KEY,
    from_user_id CHAR(36) NOT NULL,
    to_user_id CHAR(36) NOT NULL,
    message TEXT NULL,
    status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,

    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_from_to_user (from_user_id, to_user_id),
    INDEX idx_from_user_id (from_user_id),
    INDEX idx_to_user_id (to_user_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at)
);
```

### 2.4 File Management Tables

#### files
```sql
CREATE TABLE files (
    id CHAR(36) PRIMARY KEY,
    uploader_id CHAR(36) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_type ENUM('image', 'document', 'video', 'audio', 'other') NOT NULL,
    width INT NULL,
    height INT NULL,
    duration INT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INT DEFAULT 0,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,

    FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_uploader_id (uploader_id),
    INDEX idx_file_type (file_type),
    INDEX idx_mime_type (mime_type),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
);
```

### 2.5 Notification Tables

#### notifications
```sql
CREATE TABLE notifications (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSON NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);
```

#### push_notification_logs
```sql
CREATE TABLE push_notification_logs (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    notification_id CHAR(36) NULL,
    platform ENUM('ios', 'android', 'web') NOT NULL,
    status ENUM('sent', 'delivered', 'failed') NOT NULL,
    response_data JSON NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_device_id (device_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at)
);
```

### 2.6 Settings & Configuration Tables

#### user_preferences
```sql
CREATE TABLE user_preferences (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_preference (user_id, preference_key),
    INDEX idx_user_id (user_id),
    INDEX idx_preference_key (preference_key)
);
```

#### user_sessions
```sql
CREATE TABLE user_sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    session_token VARCHAR(500) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    location VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_device_id (device_id),
    INDEX idx_session_token (session_token),
    INDEX idx_is_active (is_active),
    INDEX idx_expires_at (expires_at)
);
```

## 3. Laravel Models

### 3.1 Base Model Setup
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

abstract class BaseModel extends Model
{
    use HasUuids, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $dates = ['deleted_at'];

    protected $hidden = ['deleted_at'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];
}
```

### 3.2 Core Models

#### User Model
```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasUuids, SoftDeletes, HasRoles;

    protected $fillable = [
        'username', 'email', 'password', 'full_name', 'avatar_url',
        'bio', 'phone', 'department', 'position', 'status_message',
        'timezone', 'language', 'is_verified', 'is_active'
    ];

    protected $hidden = [
        'password', 'remember_token', 'two_factor_secret', 'deleted_at'
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_seen' => 'datetime',
        'is_online' => 'boolean',
        'is_verified' => 'boolean',
        'is_active' => 'boolean',
        'two_factor_enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    // Relationships
    public function devices()
    {
        return $this->hasMany(UserDevice::class);
    }

    public function contacts()
    {
        return $this->hasMany(Contact::class);
    }

    public function sentContactRequests()
    {
        return $this->hasMany(ContactRequest::class, 'from_user_id');
    }

    public function receivedContactRequests()
    {
        return $this->hasMany(ContactRequest::class, 'to_user_id');
    }

    public function chatParticipations()
    {
        return $this->hasMany(ChatParticipant::class);
    }

    public function chats()
    {
        return $this->belongsToMany(Chat::class, 'chat_participants')
                    ->withPivot('role', 'joined_at', 'last_read_message_id', 'is_muted', 'is_pinned')
                    ->withTimestamps();
    }

    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    public function preferences()
    {
        return $this->hasMany(UserPreference::class);
    }

    public function sessions()
    {
        return $this->hasMany(UserSession::class);
    }

    public function uploadedFiles()
    {
        return $this->hasMany(File::class, 'uploader_id');
    }

    // Scopes
    public function scopeOnline($query)
    {
        return $query->where('is_online', true);
    }

    public function scopeVerified($query)
    {
        return $query->where('is_verified', true);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByDepartment($query, $department)
    {
        return $query->where('department', $department);
    }

    // Accessors & Mutators
    public function getIsOnlineAttribute($value)
    {
        if (!$value) return false;

        // Consider user offline if last_seen is more than 5 minutes ago
        return $this->last_seen && $this->last_seen->diffInMinutes(now()) <= 5;
    }

    public function setPasswordAttribute($value)
    {
        $this->attributes['password'] = bcrypt($value);
    }

    // Helper Methods
    public function updateOnlineStatus($isOnline = true)
    {
        $this->update([
            'is_online' => $isOnline,
            'last_seen' => now()
        ]);
    }

    public function getPreference($key, $default = null)
    {
        $preference = $this->preferences()->where('preference_key', $key)->first();
        return $preference ? $preference->preference_value : $default;
    }

    public function setPreference($key, $value)
    {
        return $this->preferences()->updateOrCreate(
            ['preference_key' => $key],
            ['preference_value' => $value]
        );
    }
}
```

#### Chat Model
```php
<?php

namespace App\Models;

class Chat extends BaseModel
{
    protected $fillable = [
        'type', 'name', 'description', 'avatar_url', 'created_by',
        'last_message_id', 'participants_count', 'settings', 'is_archived'
    ];

    protected $casts = [
        'settings' => 'array',
        'is_archived' => 'boolean',
        'last_activity' => 'datetime',
    ];

    // Relationships
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lastMessage()
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    public function participants()
    {
        return $this->belongsToMany(User::class, 'chat_participants')
                    ->withPivot('role', 'joined_at', 'last_read_message_id', 'is_muted', 'is_pinned', 'left_at')
                    ->withTimestamps();
    }

    public function chatParticipants()
    {
        return $this->hasMany(ChatParticipant::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    // Scopes
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->whereHas('participants', function ($q) use ($userId) {
            $q->where('user_id', $userId)->whereNull('left_at');
        });
    }

    public function scopeActive($query)
    {
        return $query->where('is_archived', false);
    }

    // Helper Methods
    public function addParticipant($userId, $role = 'member')
    {
        return $this->participants()->attach($userId, [
            'role' => $role,
            'joined_at' => now()
        ]);
    }

    public function removeParticipant($userId)
    {
        return $this->participants()->updateExistingPivot($userId, [
            'left_at' => now()
        ]);
    }

    public function updateLastActivity($messageId = null)
    {
        $data = ['last_activity' => now()];
        if ($messageId) {
            $data['last_message_id'] = $messageId;
        }

        return $this->update($data);
    }

    public function getUnreadCountForUser($userId)
    {
        $participant = $this->chatParticipants()
                           ->where('user_id', $userId)
                           ->first();

        if (!$participant || !$participant->last_read_message_id) {
            return $this->messages()->count();
        }

        $lastReadMessage = Message::find($participant->last_read_message_id);
        if (!$lastReadMessage) {
            return $this->messages()->count();
        }

        return $this->messages()
                   ->where('created_at', '>', $lastReadMessage->created_at)
                   ->count();
    }
}
```

#### Message Model
```php
<?php

namespace App\Models;

class Message extends BaseModel
{
    protected $fillable = [
        'chat_id', 'sender_id', 'reply_to_id', 'content', 'type',
        'metadata', 'is_system_message', 'is_edited', 'edited_at'
    ];

    protected $casts = [
        'metadata' => 'array',
        'is_system_message' => 'boolean',
        'is_edited' => 'boolean',
        'edited_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    // Relationships
    public function chat()
    {
        return $this->belongsTo(Chat::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyTo()
    {
        return $this->belongsTo(Message::class, 'reply_to_id');
    }

    public function replies()
    {
        return $this->hasMany(Message::class, 'reply_to_id');
    }

    public function attachments()
    {
        return $this->belongsToMany(File::class, 'message_attachments');
    }

    public function reactions()
    {
        return $this->hasMany(MessageReaction::class);
    }

    public function readReceipts()
    {
        return $this->hasMany(MessageReadReceipt::class);
    }

    // Scopes
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeByChat($query, $chatId)
    {
        return $query->where('chat_id', $chatId);
    }

    public function scopeBySender($query, $senderId)
    {
        return $query->where('sender_id', $senderId);
    }

    public function scopeRecent($query, $limit = 50)
    {
        return $query->orderBy('created_at', 'desc')->limit($limit);
    }

    public function scopeBeforeMessage($query, $messageId)
    {
        $message = static::find($messageId);
        if ($message) {
            return $query->where('created_at', '<', $message->created_at);
        }
        return $query;
    }

    public function scopeAfterMessage($query, $messageId)
    {
        $message = static::find($messageId);
        if ($message) {
            return $query->where('created_at', '>', $message->created_at);
        }
        return $query;
    }

    // Helper Methods
    public function markAsRead($userId)
    {
        return $this->readReceipts()->updateOrCreate(
            ['user_id' => $userId],
            ['read_at' => now()]
        );
    }

    public function addReaction($userId, $emoji)
    {
        return $this->reactions()->updateOrCreate(
            ['user_id' => $userId, 'emoji' => $emoji]
        );
    }

    public function removeReaction($userId, $emoji)
    {
        return $this->reactions()
                   ->where('user_id', $userId)
                   ->where('emoji', $emoji)
                   ->delete();
    }

    public function getReactionCounts()
    {
        return $this->reactions()
                   ->selectRaw('emoji, COUNT(*) as count')
                   ->groupBy('emoji')
                   ->pluck('count', 'emoji')
                   ->toArray();
    }

    public function isReadBy($userId)
    {
        return $this->readReceipts()
                   ->where('user_id', $userId)
                   ->exists();
    }
}
```

## 4. API Controllers

### 4.1 Base API Controller
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

abstract class BaseApiController extends Controller
{
    protected function successResponse($data = null, $message = 'Success', $meta = null): JsonResponse
    {
        $response = [
            'success' => true,
            'message' => $message,
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        if ($meta !== null) {
            $response['meta'] = $meta;
        }

        return response()->json($response);
    }

    protected function errorResponse($message = 'Error', $errors = null, $statusCode = 400): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        $response['meta'] = [
            'request_id' => request()->header('X-Request-ID') ?? uniqid(),
            'timestamp' => now()->toISOString(),
        ];

        return response()->json($response, $statusCode);
    }

    protected function paginatedResponse($paginator, $message = 'Data retrieved successfully'): JsonResponse
    {
        return $this->successResponse(
            $paginator->items(),
            $message,
            [
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'has_next_page' => $paginator->hasMorePages(),
                    'has_prev_page' => $paginator->currentPage() > 1,
                ]
            ]
        );
    }
}
```

### 4.2 Auth Controller
```php
<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Api\V1\BaseApiController;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Requests\Api\V1\Auth\RegisterRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Services\AuthService;
use Illuminate\Http\Request;

class AuthController extends BaseApiController
{
    protected $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    public function login(LoginRequest $request)
    {
        try {
            $result = $this->authService->login(
                $request->validated(),
                $request->ip(),
                $request->userAgent()
            );

            return $this->successResponse($result, 'Authentication successful');
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), null, 401);
        }
    }

    public function refresh(Request $request)
    {
        try {
            $result = $this->authService->refreshToken($request->refresh_token);
            return $this->successResponse($result, 'Token refreshed successfully');
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), null, 401);
        }
    }

    public function logout(Request $request)
    {
        try {
            $this->authService->logout(
                auth()->user(),
                $request->device_id
            );
            return $this->successResponse(null, 'Logout successful');
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function profile()
    {
        return $this->successResponse(
            new UserResource(auth()->user())
        );
    }
}
```

### 4.3 Chat Controller
```php
<?php

namespace App\Http\Controllers\Api\V1\Chat;

use App\Http\Controllers\Api\V1\BaseApiController;
use App\Http\Requests\Api\V1\Chat\CreateChatRequest;
use App\Http\Requests\Api\V1\Chat\SendMessageRequest;
use App\Http\Resources\Api\V1\ChatResource;
use App\Http\Resources\Api\V1\MessageResource;
use App\Services\ChatService;
use Illuminate\Http\Request;

class ChatController extends BaseApiController
{
    protected $chatService;

    public function __construct(ChatService $chatService)
    {
        $this->chatService = $chatService;
    }

    public function index(Request $request)
    {
        $chats = $this->chatService->getUserChats(
            auth()->id(),
            $request->all()
        );

        return $this->paginatedResponse(
            ChatResource::collection($chats),
            'Conversations retrieved successfully'
        );
    }

    public function store(CreateChatRequest $request)
    {
        try {
            $chat = $this->chatService->createChat(
                auth()->id(),
                $request->validated()
            );

            return $this->successResponse(
                new ChatResource($chat),
                'Conversation created successfully',
                201
            );
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function show($chatId)
    {
        try {
            $chat = $this->chatService->getChatDetails($chatId, auth()->id());
            return $this->successResponse(new ChatResource($chat));
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), null, 404);
        }
    }

    public function messages($chatId, Request $request)
    {
        try {
            $messages = $this->chatService->getChatMessages(
                $chatId,
                auth()->id(),
                $request->all()
            );

            return $this->paginatedResponse(
                MessageResource::collection($messages),
                'Messages retrieved successfully'
            );
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function sendMessage($chatId, SendMessageRequest $request)
    {
        try {
            $message = $this->chatService->sendMessage(
                $chatId,
                auth()->id(),
                $request->validated()
            );

            return $this->successResponse(
                new MessageResource($message),
                'Message sent successfully',
                201
            );
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }
    }

    public function markAsRead($chatId, Request $request)
    {
        try {
            $this->chatService->markChatAsRead(
                $chatId,
                auth()->id(),
                $request->last_read_message_id
            );

            return $this->successResponse(null, 'Conversation marked as read');
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage());
        }
    }
}
```

## 5. Middleware

### 5.1 API Authentication Middleware
```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Auth\AuthenticationException;

class ApiAuthentication
{
    public function handle(Request $request, Closure $next)
    {
        if (!auth('sanctum')->check()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
                'error_code' => 'UNAUTHORIZED'
            ], 401);
        }

        // Update user's last activity
        auth()->user()->update(['last_seen' => now()]);

        return $next($request);
    }
}
```

### 5.2 Rate Limiting Middleware
```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiter;
use Illuminate\Support\Str;

class ApiRateLimit
{
    protected $limiter;

    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }

    public function handle(Request $request, Closure $next, $maxAttempts = 1000, $decayMinutes = 1)
    {
        $key = $this->resolveRequestSignature($request);

        if ($this->limiter->tooManyAttempts($key, $maxAttempts)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many requests',
                'error_code' => 'RATE_LIMITED'
            ], 429);
        }

        $this->limiter->hit($key, $decayMinutes * 60);

        $response = $next($request);

        $response->headers->add([
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => $this->limiter->retriesLeft($key, $maxAttempts),
        ]);

        return $response;
    }

    protected function resolveRequestSignature(Request $request)
    {
        return sha1(
            $request->method() .
            '|' . $request->server('SERVER_NAME') .
            '|' . $request->path() .
            '|' . ($request->user()->id ?? $request->ip())
        );
    }
}
```

## 6. Services

### 6.1 Chat Service
```php
<?php

namespace App\Services;

use App\Models\Chat;
use App\Models\User;
use App\Models\Message;
use App\Events\MessageSent;
use App\Events\UserTyping;
use Illuminate\Support\Facades\DB;

class ChatService
{
    public function createChat($userId, array $data)
    {
        return DB::transaction(function () use ($userId, $data) {
            $chat = Chat::create([
                'type' => $data['type'],
                'name' => $data['name'] ?? null,
                'description' => $data['description'] ?? null,
                'created_by' => $userId,
                'participants_count' => count($data['participants']) + 1,
            ]);

            // Add creator as admin
            $chat->addParticipant($userId, 'admin');

            // Add other participants
            foreach ($data['participants'] as $participantId) {
                $chat->addParticipant($participantId, 'member');
            }

            return $chat->load('participants', 'creator');
        });
    }

    public function getUserChats($userId, array $filters = [])
    {
        $query = Chat::forUser($userId)
                    ->with(['lastMessage.sender', 'participants'])
                    ->orderBy('last_activity', 'desc');

        if (isset($filters['search'])) {
            $query->where('name', 'like', '%' . $filters['search'] . '%');
        }

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function sendMessage($chatId, $senderId, array $data)
    {
        return DB::transaction(function () use ($chatId, $senderId, $data) {
            $message = Message::create([
                'chat_id' => $chatId,
                'sender_id' => $senderId,
                'content' => $data['content'],
                'type' => $data['type'],
                'reply_to_id' => $data['reply_to'] ?? null,
                'metadata' => $data['metadata'] ?? null,
            ]);

            // Attach files if provided
            if (isset($data['attachments'])) {
                $message->attachments()->sync($data['attachments']);
            }

            // Update chat's last activity
            $chat = Chat::find($chatId);
            $chat->updateLastActivity($message->id);

            // Broadcast message to chat participants
            broadcast(new MessageSent($message))->toOthers();

            return $message->load('sender', 'attachments', 'replyTo');
        });
    }

    public function markChatAsRead($chatId, $userId, $lastReadMessageId = null)
    {
        $participant = ChatParticipant::where('chat_id', $chatId)
                                    ->where('user_id', $userId)
                                    ->first();

        if ($participant) {
            $participant->update([
                'last_read_message_id' => $lastReadMessageId,
                'last_read_at' => now(),
            ]);
        }
    }

    public function updateTypingStatus($chatId, $userId, $isTyping)
    {
        $cacheKey = "typing:{$chatId}:{$userId}";

        if ($isTyping) {
            cache()->put($cacheKey, true, 30); // 30 seconds
        } else {
            cache()->forget($cacheKey);
        }

        broadcast(new UserTyping($chatId, $userId, $isTyping))->toOthers();
    }

    public function getTypingUsers($chatId)
    {
        $typingUsers = [];
        $chat = Chat::find($chatId);

        foreach ($chat->participants as $participant) {
            $cacheKey = "typing:{$chatId}:{$participant->id}";
            if (cache()->has($cacheKey)) {
                $typingUsers[] = $participant;
            }
        }

        return $typingUsers;
    }
}
```

### 6.2 Notification Service
```php
<?php

namespace App\Services;

use App\Models\User;
use App\Models\Notification;
use App\Jobs\SendPushNotificationJob;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    public function createNotification($userId, $type, $title, $body, $data = null)
    {
        return Notification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ]);
    }

    public function sendPushNotification($userId, $notification)
    {
        $user = User::with('devices')->find($userId);

        foreach ($user->devices as $device) {
            if ($device->push_token && $device->is_active) {
                SendPushNotificationJob::dispatch(
                    $device,
                    $notification
                );
            }
        }
    }

    public function sendMessageNotification($message)
    {
        $chat = $message->chat;
        $sender = $message->sender;

        // Get chat participants except the sender
        $participants = $chat->participants()
                            ->where('user_id', '!=', $sender->id)
                            ->get();

        foreach ($participants as $participant) {
            // Check if user has muted this chat
            $pivot = $participant->pivot;
            if ($pivot->is_muted) {
                continue;
            }

            // Create notification
            $notification = $this->createNotification(
                $participant->id,
                'message',
                $chat->type === 'individual' ? $sender->full_name : $chat->name,
                $message->content ?: '[Media]',
                [
                    'chat_id' => $chat->id,
                    'message_id' => $message->id,
                    'sender_id' => $sender->id,
                ]
            );

            // Send push notification
            $this->sendPushNotification($participant->id, $notification);
        }
    }

    public function getUserNotifications($userId, array $filters = [])
    {
        $query = Notification::where('user_id', $userId)
                            ->orderBy('created_at', 'desc');

        if (isset($filters['unread_only']) && $filters['unread_only']) {
            $query->where('is_read', false);
        }

        if (isset($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function markAsRead($notificationId, $userId)
    {
        return Notification::where('id', $notificationId)
                          ->where('user_id', $userId)
                          ->update([
                              'is_read' => true,
                              'read_at' => now(),
                          ]);
    }

    public function markAllAsRead($userId)
    {
        return Notification::where('user_id', $userId)
                          ->where('is_read', false)
                          ->update([
                              'is_read' => true,
                              'read_at' => now(),
                          ]);
    }
}
```

## 7. Jobs & Queues

### 7.1 Send Push Notification Job
```php
<?php

namespace App\Jobs;

use App\Models\UserDevice;
use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $device;
    protected $notification;

    public function __construct(UserDevice $device, Notification $notification)
    {
        $this->device = $device;
        $this->notification = $notification;
    }

    public function handle()
    {
        try {
            if ($this->device->platform === 'ios') {
                $this->sendApnsNotification();
            } elseif ($this->device->platform === 'android') {
                $this->sendFcmNotification();
            }
        } catch (\Exception $e) {
            \Log::error('Push notification failed', [
                'device_id' => $this->device->id,
                'notification_id' => $this->notification->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function sendFcmNotification()
    {
        $response = Http::withHeaders([
            'Authorization' => 'key=' . config('services.fcm.server_key'),
            'Content-Type' => 'application/json',
        ])->post('https://fcm.googleapis.com/fcm/send', [
            'to' => $this->device->push_token,
            'notification' => [
                'title' => $this->notification->title,
                'body' => $this->notification->body,
                'sound' => 'default',
            ],
            'data' => $this->notification->data ?? [],
        ]);

        $this->logNotificationResponse('fcm', $response->json());
    }

    protected function sendApnsNotification()
    {
        // Implementation for APNs
        // This would typically use a package like pusher/pusher-push-notifications
        // or directly integrate with APNs HTTP/2 API
    }

    protected function logNotificationResponse($provider, $response)
    {
        PushNotificationLog::create([
            'user_id' => $this->device->user_id,
            'device_id' => $this->device->device_id,
            'notification_id' => $this->notification->id,
            'platform' => $this->device->platform,
            'status' => isset($response['success']) && $response['success'] ? 'delivered' : 'failed',
            'response_data' => $response,
        ]);
    }
}
```

## 8. Events & Broadcasting

### 8.1 WebSocket Configuration
```php
// config/broadcasting.php
'pusher' => [
    'driver' => 'pusher',
    'key' => env('PUSHER_APP_KEY'),
    'secret' => env('PUSHER_APP_SECRET'),
    'app_id' => env('PUSHER_APP_ID'),
    'options' => [
        'cluster' => env('PUSHER_APP_CLUSTER'),
        'useTLS' => true,
        'encrypted' => true,
        'host' => env('PUSHER_HOST', '127.0.0.1'),
        'port' => env('PUSHER_PORT', 6001),
        'scheme' => env('PUSHER_SCHEME', 'http'),
    ],
]
```

### 8.2 Message Events
```php
<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;

    public function __construct(Message $message)
    {
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('chat.' . $this->message->chat_id);
    }

    public function broadcastWith()
    {
        return [
            'type' => 'message_received',
            'data' => [
                'chat_id' => $this->message->chat_id,
                'message' => new MessageResource($this->message),
            ],
        ];
    }
}
```

## 9. Testing Requirements

### 9.1 Feature Tests
```php
<?php

namespace Tests\Feature\Api\V1;

use Tests\TestCase;
use App\Models\User;
use App\Models\Chat;
use Laravel\Sanctum\Sanctum;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_individual_chat()
    {
        $user = User::factory()->create();
        $contact = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/chats', [
            'type' => 'individual',
            'participants' => [$contact->id],
        ]);

        $response->assertStatus(201)
                ->assertJsonStructure([
                    'success',
                    'message',
                    'data' => [
                        'id',
                        'type',
                        'participants',
                    ],
                ]);
    }

    public function test_user_can_send_message()
    {
        $user = User::factory()->create();
        $chat = Chat::factory()->create();
        $chat->addParticipant($user->id);
        Sanctum::actingAs($user);

        $response = $this->postJson("/api/v1/chats/{$chat->id}/messages", [
            'content' => 'Hello, World!',
            'type' => 'text',
        ]);

        $response->assertStatus(201)
                ->assertJsonPath('data.content', 'Hello, World!');
    }
}
```

## 10. Deployment Configuration

### 10.1 Environment Variables
```env
# App Configuration
APP_NAME="AChat Enterprise"
APP_ENV=production
APP_KEY=base64:your-app-key
APP_DEBUG=false
APP_URL=https://api.achat.enterprise.com

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=achat_enterprise
DB_USERNAME=achat_user
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Queue
QUEUE_CONNECTION=redis
QUEUE_FAILED_DRIVER=database-uuids

# Broadcasting
BROADCAST_DRIVER=pusher
PUSHER_APP_ID=your-pusher-app-id
PUSHER_APP_KEY=your-pusher-key
PUSHER_APP_SECRET=your-pusher-secret
PUSHER_APP_CLUSTER=mt1

# File Storage
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=achat-files
AWS_USE_PATH_STYLE_ENDPOINT=false

# Push Notifications
FCM_SERVER_KEY=your-fcm-server-key
APNS_CERTIFICATE_PATH=/path/to/apns.pem
APNS_PASSPHRASE=your-apns-passphrase

# Search
SCOUT_DRIVER=meilisearch
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_KEY=your-meilisearch-key
```

### 10.2 Supervisor Configuration
```ini
[program:achat-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/achat/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/var/www/achat/storage/logs/worker.log
stopwaitsecs=3600
```

This comprehensive Laravel backend requirements document provides all the necessary specifications for implementing a robust, scalable, and maintainable backend for the AChat enterprise communication application.