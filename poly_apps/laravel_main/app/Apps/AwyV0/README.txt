================================================================================
AwyV0 Application - Usage Guide
================================================================================
Version: 0.1.0
Last Updated: 2025-12-03
Application: Family Safety Guardian (AnWuYou)
================================================================================

CONTENTS
--------
1. Application Overview
2. Directory Structure
3. Installation & Initialization
4. API Endpoints Reference
5. Database Schema
6. Development Guide
7. Testing
8. Troubleshooting

================================================================================
1. APPLICATION OVERVIEW
================================================================================

AwyV0 (AnWuYou V0) is a family safety guardian application that provides:
- Real-time location tracking
- Friend/family member monitoring
- Health data tracking
- Chat messaging
- Device management
- AI assistant integration

The application follows Laravel best practices and integrates with the
core_node multi-app architecture.

Target Platforms:
- React Native (iOS/Android)
- Flutter (iOS/Android/Web)
- Web Dashboard

Backend Framework: Laravel 11.x
Database: SQLite (awy_v0_database.sqlite)
Connection Name: awyv0

================================================================================
2. DIRECTORY STRUCTURE
================================================================================

poly_apps/laravel_main/app/Apps/AwyV0/
├── AwyV0Api/                          # API documentation and generation
│   ├── AwyV0apis.awy.md              # API specification
│   └── AwyV0api_create.py            # API generator script
│
├── AwyV0Auth/                         # Authentication controllers
│   ├── AwyV0AuthPublic/              # Public auth endpoints
│   │   ├── AwyV0UserLogin.php        # Login handler
│   │   ├── AwyV0UserInitEnsure.php   # User initialization
│   │   └── AwyV0AwyUserGen.php       # User generation
│   └── AwyV0AuthenticatedSessionCtl.php  # Session management
│
├── AwyV0Controllers/                  # Business logic controllers
│   ├── AwyV0AuthCtl.php              # Authentication endpoints
│   ├── AwyV0UserCtl.php              # User management
│   ├── AwyV0FriendCtl.php            # Friend management
│   ├── AwyV0ChatCtl.php              # Chat messaging
│   ├── AwyV0DeviceCtl.php            # Device tracking
│   ├── AwyV0HealthCtl.php            # Health data
│   ├── AwyV0SearchCtl.php            # User search
│   └── AwyV0DashboardCtl.php         # Dashboard data
│
├── AwyV0DBTablesBrige/                # Database table mappings
│   └── AwyV0TableMaps.php            # Centralized table definitions
│
├── AwyV0Gvar/                         # Global variables
│   └── AwyV0Gvar.php                 # App-specific constants
│
├── AwyV0Welcome/                      # Welcome/landing pages
│   └── AwyV0Awywelcome.php           # Welcome controller
│
├── Utils/                             # Utility classes
│   ├── AwyV0Initializer.php          # System initializer
│   └── GenVoiceName.php              # Voice name generator
│
├── AwyV0ApiInfo.php                   # API information provider
└── README.txt                         # This file

Routes Configuration:
├── routes/AwyV0Router/
│   ├── AwyV0Auth.php                 # Authentication routes
│   ├── AwyV0User.php                 # User routes
│   ├── AwyV0Friend.php               # Friend routes
│   ├── AwyV0Chat.php                 # Chat routes
│   └── AwyV0Device.php               # Device routes

Database Migrations:
└── database/migrations/
    └── AwyV0_2025_12_03_create_awy_v0_tables.php

================================================================================
3. INSTALLATION & INITIALIZATION
================================================================================

3.1 System Requirements
-----------------------
- PHP 8.2+
- Laravel 11.x
- SQLite extension enabled
- Composer
- Node.js (for Octane hot-reload)

3.2 Initialize AwyV0
--------------------
Run the following command to initialize the AwyV0 application:

    php artisan sys:init

This command will:
✓ Check database connection
✓ Create database file (awy_v0_database.sqlite)
✓ Run migrations (create all tables)
✓ Verify table creation
✓ Create database indexes
✓ Seed initial data (if needed)

The initialization is idempotent - safe to run multiple times.

3.3 Check Initialization Status
--------------------------------
To check if AwyV0 is properly initialized:

    php artisan sys:init

Look for:
    ✅ AwyV0
       ✅ database_connection: Check database connection
       ✅ create_database_file: Create database file if not exists
       ✅ run_migrations: Run database migrations
       ✅ verify_tables: Verify all tables created
       ✅ create_indexes: Create database indexes
       ✅ seed_initial_data: Seed initial data if needed

3.4 Reset Initialization (Development Only)
--------------------------------------------
To reset the initialization status:

    # Delete the status file
    rm storage/external/database/awy_v0_init_status.json

    # Re-run initialization
    php artisan sys:init

================================================================================
4. API ENDPOINTS REFERENCE
================================================================================

Base URL: /api/awy-v0
Authentication: Bearer Token in Authorization header

4.1 Authentication Endpoints
-----------------------------

POST /api/awy-v0/auth/send-code
    Description: Send verification code to phone
    Auth Required: No
    Body: { "phone": "13800138000" }
    Response: { "success": true, "data": { "expiresIn": 300 } }

POST /api/awy-v0/auth/register
    Description: Register new user
    Auth Required: No
    Body: {
        "phone": "13800138000",
        "code": "123456",
        "name": "Alex Chen"
    }
    Response: { "success": true, "data": { "user": {...}, "token": "..." } }

POST /api/awy-v0/auth/login
    Description: User login
    Auth Required: No
    Body: { "phone": "13800138000", "code": "123456" }
    Response: { "success": true, "data": { "user": {...}, "token": "..." } }

POST /api/awy-v0/auth/logout
    Description: User logout
    Auth Required: Yes
    Response: { "success": true, "message": "Logged out successfully" }

POST /api/awy-v0/auth/refresh
    Description: Refresh access token
    Auth Required: No
    Body: { "refreshToken": "..." }
    Response: { "success": true, "data": { "token": "...", "expiresIn": 3600 } }

4.2 User Endpoints
------------------

GET /api/awy-v0/user/me
    Description: Get current user profile
    Auth Required: Yes
    Response: { "success": true, "data": { "id": "u1", "name": "...", ... } }

PUT /api/awy-v0/user/me
    Description: Update user profile
    Auth Required: Yes
    Body: { "name": "...", "signature": "...", "email": "...", ... }
    Response: { "success": true, "data": { ... } }

POST /api/awy-v0/user/avatar
    Description: Upload user avatar
    Auth Required: Yes
    Content-Type: multipart/form-data
    Body: FormData with "avatar" field
    Response: { "success": true, "data": { "avatar": "https://..." } }

4.3 Friends Endpoints
---------------------

GET /api/awy-v0/friends
    Description: Get friends list
    Auth Required: Yes
    Query: ?status=all&search=...
    Response: { "success": true, "data": [ { "id": "f1", ... }, ... ] }

GET /api/awy-v0/friends/:friendId
    Description: Get friend detail
    Auth Required: Yes
    Response: { "success": true, "data": { "id": "f1", ... } }

POST /api/awy-v0/friends/requests
    Description: Send friend request
    Auth Required: Yes
    Body: {
        "userId": "u2",
        "message": "...",
        "alias": "...",
        "relation": "Friend"
    }
    Response: { "success": true, "data": { "requestId": "req1" } }

GET /api/awy-v0/friends/requests
    Description: Get friend requests
    Auth Required: Yes
    Query: ?type=received (or "sent")
    Response: { "success": true, "data": [ { "id": "req1", ... }, ... ] }

PUT /api/awy-v0/friends/requests/:requestId
    Description: Accept/reject friend request
    Auth Required: Yes
    Body: { "action": "accept" }  # or "reject"
    Response: { "success": true, "message": "Friend request accepted" }

PUT /api/awy-v0/friends/:friendId/monitor
    Description: Toggle friend monitoring
    Auth Required: Yes
    Body: { "isMonitored": true }
    Response: { "success": true, "data": { "friendId": "f1", ... } }

DELETE /api/awy-v0/friends/:friendId
    Description: Remove friend
    Auth Required: Yes
    Response: { "success": true, "message": "Friend removed" }

4.4 Location Endpoints
----------------------

GET /api/awy-v0/friends/:friendId/location
    Description: Get friend current location
    Auth Required: Yes
    Response: {
        "success": true,
        "data": { "lat": 39.9042, "lng": 116.4074, ... }
    }

GET /api/awy-v0/friends/:friendId/history
    Description: Get location history
    Auth Required: Yes
    Query: ?startDate=2024-01-01&endDate=2024-01-31&limit=50
    Response: {
        "success": true,
        "data": { "points": [...], "summary": {...}, "pagination": {...} }
    }

POST /api/awy-v0/location
    Description: Upload current location
    Auth Required: Yes
    Body: {
        "lat": 39.9042,
        "lng": 116.4074,
        "accuracy": 10.5,
        "timestamp": "2024-01-01T10:45:00Z"
    }
    Response: { "success": true, "data": { "locationId": "loc1" } }

4.5 Health Data Endpoints
--------------------------

GET /api/awy-v0/friends/:friendId/health
    Description: Get friend health data
    Auth Required: Yes
    Query: ?date=2024-01-01
    Response: {
        "success": true,
        "data": { "steps": 8432, "heartRate": 78, "temp": 36.5, ... }
    }

GET /api/awy-v0/friends/:friendId/health/history
    Description: Get health history
    Auth Required: Yes
    Query: ?startDate=2024-01-01&metric=steps
    Response: { "success": true, "data": [ {...}, ... ] }

4.6 Device Endpoints
--------------------

GET /api/awy-v0/friends/:friendId/device
    Description: Get friend device info
    Auth Required: Yes
    Response: {
        "success": true,
        "data": { "network": "WiFi", "battery": 85, ... }
    }

4.7 Chat Endpoints
------------------

GET /api/awy-v0/chat/:friendId/messages
    Description: Get chat history
    Auth Required: Yes
    Query: ?limit=50&before=msg123
    Response: { "success": true, "data": { "messages": [...], "hasMore": false } }

POST /api/awy-v0/chat/:friendId/messages
    Description: Send message
    Auth Required: Yes
    Body: { "content": "Hello!", "type": "text" }
    Response: { "success": true, "data": { "id": "msg2", ... } }

PUT /api/awy-v0/chat/:friendId/messages/read
    Description: Mark messages as read
    Auth Required: Yes
    Body: { "messageIds": ["msg1", "msg2"] }
    Response: { "success": true, "data": { "readCount": 2 } }

GET /api/awy-v0/chat/unread-count
    Description: Get unread message count
    Auth Required: Yes
    Response: {
        "success": true,
        "data": { "total": 5, "byFriend": { "f1": 3, "f2": 2 } }
    }

4.8 Products Endpoints
----------------------

GET /api/awy-v0/products
    Description: Get products list
    Auth Required: Yes
    Query: ?category=watch&lat=39.9042&lng=116.4074
    Response: {
        "success": true,
        "data": { "products": [...], "pagination": {...} }
    }

GET /api/awy-v0/products/:productId
    Description: Get product detail
    Auth Required: Yes
    Response: { "success": true, "data": { "id": "p1", ... } }

4.9 AI Assistant Endpoints
---------------------------

POST /api/awy-v0/ai/chat
    Description: Send AI message
    Auth Required: Yes
    Body: {
        "message": "What are safety trends?",
        "context": { "friendIds": ["f1", "f2"] }
    }
    Response: { "success": true, "data": { "id": "ai_msg1", "message": "..." } }

GET /api/awy-v0/ai/chat/history
    Description: Get AI chat history
    Auth Required: Yes
    Query: ?limit=20&offset=0
    Response: { "success": true, "data": { "messages": [...], "hasMore": false } }

4.10 Search Endpoints
---------------------

GET /api/awy-v0/users/search
    Description: Search users
    Auth Required: Yes
    Query: ?phone=13800138000
    Response: {
        "success": true,
        "data": [ { "id": "u2", "name": "...", "isFriend": false, ... }, ... ]
    }

================================================================================
5. DATABASE SCHEMA
================================================================================

5.1 Users Table (awy_v0_users)
-------------------------------
Primary user account information

Columns:
- id (bigint, primary key)
- username (varchar, unique)
- email (varchar, unique, nullable)
- phone (varchar(20), unique, nullable)
- password (varchar)
- name (varchar, nullable)
- avatar (varchar, nullable)
- signature (varchar, nullable)
- gender (enum: male, female, nullable)
- address (varchar, nullable)
- birthday (date, nullable)
- id_card (varchar, nullable)
- user_token (varchar, nullable)
- status (int, default: 1)
- created_at, updated_at, deleted_at

Indexes:
- username, email, phone

5.2 Verification Codes Table (awy_v0_verification_codes)
---------------------------------------------------------
SMS/Phone verification codes for login/registration

Columns:
- id (bigint, primary key)
- phone (varchar(20))
- code (varchar(10))
- expires_at (timestamp)
- used (boolean, default: false)
- created_at, updated_at

Indexes:
- phone, expires_at

5.3 Friend Requests Table (awy_v0_friend_requests)
---------------------------------------------------
Pending friend requests

Columns:
- id (bigint, primary key)
- from_user_id (bigint)
- to_user_id (bigint)
- message (varchar, nullable)
- alias (varchar, nullable)
- relation (enum: Partner, Child, Parent, Friend, Family)
- status (enum: pending, accepted, rejected, default: pending)
- created_at, updated_at

Indexes:
- from_user_id, to_user_id, status

5.4 Friends Table (awy_v0_friends)
-----------------------------------
Established friendships

Columns:
- id (bigint, primary key)
- user_id (bigint)
- friend_id (bigint)
- relation (enum: Partner, Child, Parent, Friend, Family)
- alias (varchar, nullable)
- days_connected (int, default: 0)
- is_monitored (boolean, default: false)
- status (enum: active, blocked, default: active)
- created_at, updated_at

Indexes:
- user_id, friend_id
- unique(user_id, friend_id)

5.5 Devices Table (awy_v0_devices)
-----------------------------------
User devices and tracking data

Columns:
- id (bigint, primary key)
- user_id (bigint)
- device_name (varchar)
- device_type (varchar)
- device_token (varchar, nullable)
- platform (varchar, nullable)
- network (varchar, nullable)
- unlocks (int, default: 0)
- usage_time_minutes (int, default: 0)
- battery (int, nullable)
- last_unlock (timestamp, nullable)
- created_at, updated_at

Indexes:
- user_id, device_token

5.6 Locations Table (awy_v0_locations)
---------------------------------------
Current location data

Columns:
- id (bigint, primary key)
- user_id (bigint)
- lat (decimal(10,7))
- lng (decimal(10,7))
- address (varchar, nullable)
- accuracy (decimal(8,2), nullable)
- speed (decimal(8,2), nullable)
- heading (decimal(8,2), nullable)
- location_timestamp (timestamp)
- created_at, updated_at

Indexes:
- user_id, location_timestamp

5.7 Location History Table (awy_v0_location_history)
-----------------------------------------------------
Historical location visits

Columns:
- id (bigint, primary key)
- user_id (bigint)
- location_name (varchar, nullable)
- address (varchar, nullable)
- lat (decimal(10,7))
- lng (decimal(10,7))
- duration_minutes (int, nullable)
- visited_at (timestamp)
- left_at (timestamp, nullable)
- created_at, updated_at

Indexes:
- user_id, visited_at

5.8 Health Data Table (awy_v0_health_data)
-------------------------------------------
Daily health metrics

Columns:
- id (bigint, primary key)
- user_id (bigint)
- steps (int, default: 0)
- heart_rate (int, nullable)
- temperature (decimal(4,1), nullable)
- data_date (date)
- created_at, updated_at

Indexes:
- user_id, data_date
- unique(user_id, data_date)

5.9 Chats Table (awy_v0_chats)
-------------------------------
Chat messages between users

Columns:
- id (bigint, primary key)
- sender_id (bigint)
- receiver_id (bigint)
- message (text)
- message_type (enum: text, image, voice, video, default: text)
- read (boolean, default: false)
- status (enum: sent, delivered, read, deleted, default: sent)
- created_at, updated_at

Indexes:
- sender_id, receiver_id
- (sender_id, receiver_id) composite
- created_at

5.10 Products Table (awy_v0_products)
--------------------------------------
Safety products catalog

Columns:
- id (bigint, primary key)
- name (varchar)
- name_en (varchar, nullable)
- price (decimal(10,2))
- currency (varchar(10), default: CNY)
- rating (decimal(3,2), default: 0)
- reviews_count (int, default: 0)
- image (varchar, nullable)
- images (json, nullable)
- description (text, nullable)
- description_en (text, nullable)
- category (enum: watch, accessory, health, default: watch)
- specifications (json, nullable)
- in_stock (boolean, default: true)
- stock_count (int, default: 0)
- created_at, updated_at

Indexes:
- category, in_stock

5.11 AI Chat History Table (awy_v0_ai_chat_history)
----------------------------------------------------
AI assistant conversation history

Columns:
- id (bigint, primary key)
- user_id (bigint)
- role (enum: user, assistant, default: user)
- content (text)
- context (json, nullable)
- created_at, updated_at

Indexes:
- user_id, created_at

================================================================================
6. DEVELOPMENT GUIDE
================================================================================

6.1 Using Table Mappings
-------------------------
ALWAYS use AwyV0TableMaps for table and field names:

    use App\Apps\AwyV0\AwyV0DBTablesBrige\AwyV0TableMaps;

    // Get table name
    $tableName = AwyV0TableMaps::getTableName('AWY_V0_USERS');
    // Returns: 'awy_v0_users'

    // Get field name
    $fieldName = AwyV0TableMaps::getFieldName('AWY_V0_USERS', 'username');
    // Returns: 'username'

    // Get all fields
    $fields = AwyV0TableMaps::getTableFields('AWY_V0_USERS');

Available table keys:
- AWY_V0_USERS
- AWY_V0_FRIENDS
- AWY_V0_DEVICES
- AWY_V0_CHATS
- AWY_V0_VERIFICATION_CODES
- AWY_V0_FRIEND_REQUESTS
- AWY_V0_LOCATIONS
- AWY_V0_LOCATION_HISTORY
- AWY_V0_HEALTH_DATA
- AWY_V0_PRODUCTS
- AWY_V0_AI_CHAT_HISTORY

6.2 Database Connection
------------------------
Use the 'awyv0' connection:

    use Illuminate\Support\Facades\DB;

    $users = DB::connection('awyv0')
        ->table('awy_v0_users')
        ->where('status', 1)
        ->get();

Or with Eloquent models (if defined):

    protected $connection = 'awyv0';
    protected $table = 'awy_v0_users';

6.3 API Response Format
------------------------
All API responses follow this standard format:

Success:
    {
        "success": true,
        "message": "Operation successful",
        "data": { ... }
    }

Error:
    {
        "success": false,
        "error": {
            "code": "ERROR_CODE",
            "message": "Human-readable error message",
            "details": { ... }
        }
    }

6.4 Authentication
------------------
Use CommonAuthService for token management:

    use App\Http\Common\CommonAuthService;

    // Generate token
    $tokenData = CommonAuthService::generateUserToken($userId, 'AwyV0');

    // Verify token
    $user = $request->user(); // Via Laravel Sanctum middleware

6.5 Adding New Endpoints
-------------------------
1. Define route in routes/AwyV0Router/
2. Create controller method in AwyV0Controllers/
3. Update AwyV0ApiInfo.php with endpoint definition
4. Add any database changes to AwyV0TableMaps.php

6.6 Coding Standards
---------------------
- Follow PSR-12 coding standards
- Use type hints for all parameters and return types
- Document all public methods with PHPDoc
- Use dependency injection where possible
- Write descriptive variable and method names
- Keep controllers thin, move business logic to services
- Use validation for all incoming requests

================================================================================
7. TESTING
================================================================================

7.1 Manual API Testing
-----------------------
Use Postman, Insomnia, or curl:

    # Register user
    curl -X POST http://localhost/api/awy-v0/auth/register \
      -H "Content-Type: application/json" \
      -d '{"phone":"13800138000","code":"123456","name":"Test User"}'

    # Login
    curl -X POST http://localhost/api/awy-v0/auth/login \
      -H "Content-Type: application/json" \
      -d '{"phone":"13800138000","code":"123456"}'

    # Get user profile (requires token)
    curl -X GET http://localhost/api/awy-v0/user/me \
      -H "Authorization: Bearer YOUR_TOKEN_HERE"

7.2 Database Inspection
------------------------
Check tables and data:

    # Connect to SQLite database
    sqlite3 storage/external/database/awy_v0_database.sqlite

    # List tables
    .tables

    # Show table schema
    .schema awy_v0_users

    # Query data
    SELECT * FROM awy_v0_users;

    # Exit
    .quit

7.3 Check Initialization
-------------------------
    php artisan sys:init

Look for AwyV0 section in output.

7.4 View Logs
-------------
    tail -f storage/logs/laravel.log

Filter for AwyV0:
    grep "AwyV0" storage/logs/laravel.log

================================================================================
8. TROUBLESHOOTING
================================================================================

8.1 Database Connection Error
------------------------------
Error: "Database connection failed"

Solution:
1. Check database file exists:
   ls -la storage/external/database/awy_v0_database.sqlite

2. Check permissions:
   chmod 664 storage/external/database/awy_v0_database.sqlite

3. Verify config:
   php artisan config:cache

8.2 Migration Fails
-------------------
Error: "Migration failed: table already exists"

Solution:
1. This is normal if tables exist from previous run
2. Check if tables are properly created:
   php artisan sys:init

3. To start fresh (DANGER - deletes data):
   rm storage/external/database/awy_v0_database.sqlite
   php artisan sys:init

8.3 Authentication Issues
--------------------------
Error: "Unauthenticated" or "Token mismatch"

Solution:
1. Verify token is sent in header:
   Authorization: Bearer <token>

2. Check token expiration
3. Try re-login to get new token

8.4 Route Not Found
-------------------
Error: "404 Not Found"

Solution:
1. Clear route cache:
   php artisan route:cache

2. Check route exists:
   php artisan route:list | grep awy-v0

3. Verify API prefix is correct: /api/awy-v0

8.5 Missing Tables
------------------
Error: "Table 'awy_v0_xxx' doesn't exist"

Solution:
1. Run initialization:
   php artisan sys:init

2. Check migration file exists:
   ls -la database/migrations/AwyV0_2025_12_03_create_awy_v0_tables.php

3. Manually run migration:
   php artisan migrate --database=awyv0 \
     --path=database/migrations/AwyV0_2025_12_03_create_awy_v0_tables.php

================================================================================
SUPPORT & CONTACT
================================================================================

For issues and feature requests:
- Check logs: storage/logs/laravel.log
- Review this documentation
- Contact development team

Last Updated: 2025-12-03
Version: 0.1.0

================================================================================
