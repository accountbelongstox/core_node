# Laravel API Debug Interface - Functional Modules Documentation

## Overview

Laravel API Debug Interface is a comprehensive development and debugging platform that provides multiple functional modules for API testing, system management, code browsing, and resource management.

**Access URL**: `http://192.168.50.2:9000/#`

---

## 1. 🚀 API Testing Dashboard

### Function Description
Test Laravel APIs directly in the browser without external tools like Postman.

### Core Features

#### 1.1 Application Selection
- **Location**: Top dropdown menu
- **Options**:
  - AChatV1
  - AppQyV1
  - AwyV0
  - BankV1
  - ItToolsV1
  - McpV1
  - ServerManagerV1
  - Common (General API)
- **Behavior**: Automatically loads API list for selected application

#### 1.2 API Search
- **Function**: Quick API location
- **Search Methods**:
  - API number (e.g., "1")
  - Path (e.g., "initialize")
  - Description keywords
- **Features**: Auto-highlight matches and scroll to position

#### 1.3 Shared Request Headers Management
- **Scope**: Independent configuration per application
- **Supported Headers**:
  - `Authorization`: Bearer token authentication
  - `Content-Type`: Request content type
  - `Accept`: Response content type
  - `Client-Token`: Client identification token
  - `Auth-User-Token`: User authentication token
- **Operations**:
  - Save all headers (auto-cached)
  - Reset to defaults
  - Copy headers JSON

#### 1.4 API List Display
Each API card shows:
- **Number**: #1, #2, #3...
- **HTTP Method**: POST, GET, PUT, DELETE
- **Endpoint Path**: Complete API path
- **Short Description**: API function description
- **Expand/Collapse**: Click to view details

#### 1.5 API Details Panel
When expanded, includes:

**Basic Information**:
- Authentication requirement (Required/Optional)
- HTTP method
- Function description
- Controller name

**Parameter Information**:
- Parameter list (type, required/optional, example values)
- Parameter format description

**Response Information**:
- Response field list
- Response format description

**Interactive Functions**:
- **API Endpoint URL**: Editable endpoint address
- **Request Parameters (JSON)**: JSON parameter input box (pre-filled with examples)
- **Action Buttons**:
  - `Send Request`: Send request and display response
  - `Save Params`: Save parameters to local storage
  - `Load Params`: Load parameters from local storage
  - `Copy Headers`: Copy request headers to clipboard
- **Response Area**: Display API response results

#### 1.6 Workflow
1. Select target application
2. Configure shared request headers (e.g., Authorization token)
3. Use search to quickly locate API or browse list directly
4. Expand target API to view details
5. Edit request parameters (JSON format)
6. Click "Send Request" to send request
7. View results in response area
8. Optional: Save parameters for later use

#### 1.7 Data Persistence
- **Storage Location**: Browser LocalStorage
- **Stored Content**:
  - Parameter configuration for each API
  - Shared request headers for applications
- **Features**: Supports cross-session recovery, data retained after page refresh

---

## 2. 🛠️ Development Tools

### Function Description
Provides rich online development tool collection, covering text processing, encoding conversion, encryption/decryption, formatting, and many other practical tools.

### Tool Categories

#### 2.1 📋 Online Clipboard
- **Function**: Cross-device clipboard synchronization
- **Tools**:
  - Online Clipboard

#### 2.2 🤖 AI Tools
- **Function**: AI-assisted tools
- **Tools**:
  - AI Translation

#### 2.3 🖼️ Image Tools
- **Function**: Image processing and conversion
- **Tools**:
  - Image Converter
  - Image Compressor
  - Image Resizer
  - Image Cropper
  - Image Rotator/Flipper
  - Color Picker from Image

#### 2.4 📄 PDF & Document Tools
- **Function**: PDF file processing
- **Tools**:
  - PDF Merger
  - PDF Splitter
  - PDF Compressor
  - PDF Password Protector
  - Unlock PDF
  - PDF Watermark
  - PDF Page Rotator
  - PDF to JPG/PNG
  - Image to PDF

#### 2.5 🧮 Calculator Tools
- **Function**: Various calculation tools
- **Tools**:
  - Age Calculator
  - BMI Calculator
  - Loan EMI Calculator
  - GST Calculator
  - Percentage Calculator
  - Number to Words
  - Unit Converter
  - Currency Converter

#### 2.6 🎨 Color Tools
- **Function**: Color-related tools
- **Tools**:
  - HEX to RGB Converter
  - Gradient Generator
  - Contrast Checker
  - Palette Generator
  - Color Blindness Simulator

#### 2.7 ✍️ Text Tools Advanced
- **Function**: Text processing and SEO tools
- **Tools**:
  - Remove Duplicate Lines
  - Text Sorter
  - Text Reverser
  - Word Counter (SEO)
  - Keyword Density Checker
  - Text Encryptor/Decryptor

#### 2.8 📈 SEO & Marketing
- **Function**: SEO analysis tools
- **Tools**:
  - Meta Tag Analyzer
  - Keyword Density Checker
  - Word Counter (Blog)

#### 2.9 🔧 Utility Tools
- **Function**: Daily utility tools
- **Tools**:
  - QR Code Scanner
  - Barcode Generator
  - Time Zone Converter
  - Password Generator
  - Password Strength Checker

#### 2.10 🔐 Crypto & Security
- **Function**: Encryption and security-related tools
- **Tools**:
  - Token Generator
  - Hash Generator
  - Bcrypt Hash/Verify
  - UUID Generator
  - ULID Generator
  - HMAC Generator
  - Password Strength Analyzer
  - Basic Auth Generator
  - BIP39 Passphrase
  - RSA Key Pair

#### 2.11 🔄 Converters
- **Function**: Various format conversions
- **Tools**:
  - Base64 Encoder/Decoder
  - URL Encoder/Decoder
  - HTML Entities Encoder
  - Case Converter
  - Color Converter
  - Timestamp Converter
  - Integer Base Converter
  - Roman Numeral Converter
  - Text to NATO Alphabet
  - Text to ASCII Binary
  - JSON ⇄ YAML
  - JSON ⇄ XML
  - Markdown to HTML

#### 2.12 📝 Text Tools
- **Function**: Basic text processing
- **Tools**:
  - Text Diff
  - Text Statistics
  - Lorem Ipsum Generator
  - Slugify String
  - Emoji Picker
  - String Obfuscator
  - Numeronym Generator
  - ASCII Art Generator

#### 2.13 ✨ Formatters
- **Function**: Code and text formatting
- **Tools**:
  - JSON Formatter
  - XML Formatter
  - YAML Formatter
  - SQL Formatter
  - HTML Formatter
  - CSS Formatter

#### 2.14 🌐 Web Tools
- **Function**: Web development-related tools
- **Tools**:
  - URL Parser
  - Query String Parser
  - JWT Parser
  - User Agent Parser
  - HTTP Status Codes
  - MIME Types
  - Device Information
  - Keycode Info

#### 2.15 🎲 Generators
- **Function**: Various content generation tools
- **Tools**:
  - QR Code Generator
  - WiFi QR Code
  - SVG Placeholder
  - Random Port
  - Crontab Generator
  - Open Graph Meta
  - OTP Code Generator

#### 2.16 🔢 Math & Calc
- **Function**: Mathematical calculation tools
- **Tools**:
  - Math Evaluator
  - Percentage Calculator
  - ETA Calculator
  - Temperature Converter
  - Unit Converter

#### 2.17 🌍 Network Tools
- **Function**: Network-related tools
- **Tools**:
  - IPv4 Subnet Calculator
  - IPv4 Converter
  - IPv6 ULA Generator
  - MAC Address Lookup
  - MAC Generator

#### 2.18 💻 Development
- **Function**: Development assistance tools
- **Tools**:
  - Regex Tester
  - Regex Cheatsheet
  - Git Cheatsheet
  - Chmod Calculator
  - Docker Run → Compose
  - JSON Diff
  - JSON to CSV

#### 2.19 📊 Data Tools
- **Function**: Data processing tools
- **Tools**:
  - Phone Parser
  - IBAN Validator
  - Email Normalizer

### Interface Features
- **Top Menu**: Tools, Favorites, Recent tabs
- **Search Function**: Quick tool search
- **Left Menu**: Category navigation, collapsible/expandable
- **Main Content Area**: Tool operation interface
- **Right Panel**: Tool information description (toggleable)
- **History**: Shows recently used tools
- **Favorites**: Favorite commonly used tools

---

## 3. 📊 System Information

### Function Description
Displays complete system information, including Laravel configuration, database information, system resource usage, etc.

### Display Content

#### 3.1 Core Information
- **PHP Version**: 8.4.15
- **Laravel Version**: 12.38.1
- **Environment**: local
- **Debug Mode**: Enabled
- **Timezone**: UTC

#### 3.2 Laravel Configuration Summary
- **Application Mode**: Headless API (retains Web routes for debugging)
- **Database Connections**:
  - Default connection: sqlite
  - Configured connections: 15
  - Connection list: sqlite, mysql, mariadb, pgsql, sqlsrv, AppQyV1, AwyV0, VipClubV1, ServerManagerV1, AChatV1, CodeMartV1, McpV1, ItToolsV1, BankV1
- **External Storage Paths**:
  - public_path_external: Configured outside project directory for deployment flexibility
  - storage_path_external: Configured outside project directory for shared storage
  - uploads_path: External path for user uploads and media files
  - temp_path: External temporary file processing location
- **Driver Configuration**:
  - Cache Driver: database
  - Session Driver: file
  - Queue Driver: database
  - Mail Driver: log
- **Log Channels**:
  - Default channel: syslog
  - Configured channels: stack, single, daily, slack, papertrail, stderr, syslog, errorlog, null, emergency
  - Total channels: 10
- **Route Files**:
  - Main route files: ai.php, api.php, api_ocr.php, console.php, settings.php, web.php
  - Application-specific route directories: AppQyV1Router/, AwyV0Router/, BankV1Router/, CodeMartV1Router/, ItToolsV1Router/, McpV1Router/, ServerManagerV1Router/, VipClubV1Router/
  - Total route files: 6
  - Total application route directories: 8

#### 3.3 Application Overview
- **Total Applications**: 7
- **Total APIs Across All Applications**: 174
- **Application List**:
  - AChatV1: 0 APIs, status: active
  - AppQyV1: 63 APIs, status: active
  - AwyV0: 24 APIs, status: active
  - BankV1: 16 APIs, status: active
  - ItToolsV1: 8 APIs, status: active
  - McpV1: 39 APIs, status: active
  - ServerManagerV1: 24 APIs, status: active

#### 3.4 PHP Configuration
- **Memory Limit**: 512M
- **Max Execution Time**: 0s (unlimited)
- **Upload File Size Limit**: 64M
- **POST Data Size Limit**: 64M
- **Error Display**: On
- **Command Execution**: Enabled

#### 3.5 Database Information
- **Status**: Connected
- **Connection Driver**: sqlite
- **Database Name**: /www/wwwroot/laravel_db/database.sqlite
- **Database Version**: 3.45.1

#### 3.6 System Resources
- **CPU Usage**:
  - 1 minute: 1.6494140625%
  - 5 minutes: 1.71728515625%
  - 15 minutes: 1.705078125%
- **Memory Usage**: 2.64 GB / 7.5 GB (35.13%)
- **Disk Usage**: 139.32 GB / 467.35 GB (29.81%)
- **Load Average**: 1.6494140625, 1.71728515625, 1.705078125

#### 3.7 System Information
- **Operating System**: Linux
- **Architecture**: x86_64
- **Server Software**: Unknown
- **Server IP**: Unknown

#### 3.8 External Tools
- **Git**: git version 2.43.0
- **Node**: v24.11.1
- **Python**: Python 3.12.3
- **Go**: Not installed
- **Curl**: curl 8.5.0
- **7z**: 7-Zip 23.01
- **FFmpeg**: ffmpeg version 6.1.1-3ubuntu5

#### 3.9 API Reference Information
Displays detailed API information for all applications, including:
- Application name and version
- Base URL and API prefix
- Endpoint list (path, method, function, parameters, response)
- Supported request headers
- Authentication methods

---

## 4. 📚 Vocabulary Learning

### Function Description
Vocabulary learning system related functions (based on AppQyV1 application).

### Main Functions
- User registration/login
- System initialization
- Vocabulary library management
- Learning progress tracking
- Vocabulary card learning
- Document upload and vocabulary extraction
- Translation tool integration
- TTS (Text-to-Speech) functionality

### API Endpoint Examples
- `/api/dict/v1/register`: User registration
- `/api/dict/v1/login`: User login
- `/api/dict/v1/system/initialize`: System initialization
- `/api/dict/v1/learning/words`: Get learning vocabulary
- `/api/dict/v1/learning/progress`: Update learning progress
- `/api/dict/v1/learning/upload`: Upload document to extract vocabulary

---

## 5. 💻 Code Browser

### Function Description
Online code browsing and editing tool, supporting file management, code editing, task/prompt management.

### Core Features

#### 5.1 File Tree Panel
- **Root Directory**: core_node
- **Functions**:
  - Browse project file structure
  - File/folder operations
  - Refresh file tree
- **Operations**:
  - Right-click menu supports:
    - Copy relative path
    - Copy absolute path
    - Rename
    - Auto-rename to English
    - Translate Chinese lines
    - Delete
    - Restore

#### 5.2 Code Editor
- **Functions**:
  - View and edit code files
  - Syntax highlighting
  - File saving
- **Operations**:
  - Select file to automatically load content
  - Save after editing
  - Close file

#### 5.3 Task/Prompt Management Panel
- **Function**: Manage development tasks and prompts
- **Categories**:
  - Global
  - MCP Development
  - NCORE Development
  - PYCORE Development
  - Laravel Main
  - NUXT Development
- **Operations**:
  - New task
  - Refresh list
  - View by category

#### 5.4 Prompt Mapping Panel
- **Function**: Manage prompt mapping relationships

### Authentication Requirements
- **Access Restriction**: Requires login to use
- **Login Prompt**: Shows login button when not logged in

---

## 6. 🎬 Static Resources

### Function Description
Static resource (media file) browser and management tool, supporting preview and management of images, videos, audio, text files, etc.

### Core Features

#### 6.1 File List Panel
- **Functions**:
  - Browse static resource directory structure
  - File/folder navigation
  - Display current directory path
- **Action Buttons**:
  - 📁+: New folder
  - 🔄: Refresh list
  - 📤: Upload file/folder
- **Features**:
  - Supports recursive upload of entire folders
  - Collapsible/expandable folders

#### 6.2 File Preview Panel
- **Supported File Types**:
  - Images (JPG, PNG, GIF, WebP, etc.)
  - Videos (MP4, AVI, MOV, etc.)
  - Audio (MP3, WAV, OGG, etc.)
  - Text files (TXT, MD, JSON, etc.)
- **Video Playback Functions**:
  - Auto-play next episode
  - Skip intro setting (seconds)
  - Playlist management
  - Playlist count display
  - Left/right floating buttons (previous/next episode)
- **File Information Display**:
  - File name
  - File metadata (size, type, etc.)

#### 6.3 File Sorting
- **Sorting Rules**: Ascending sort by the following keywords
  - Chinese numbers: 第一、一、二、三...
  - Arabic numbers: 1, 2, 3...
  - English format: lesson_1, lesson_2...
- **Scope**: Resources in the same directory

#### 6.4 File Operations
- **Right-click Menu**:
  - 📂 Enter this folder: Enter folder
  - ⬇️ Expand all subfolders: Expand all subfolders
  - ⬆️ Collapse all subfolders: Collapse all subfolders
  - 📤 Upload to this folder: Upload to this folder
  - 🌐 Rename to English: Rename to English
  - 🗑️ Delete: Delete file/folder

#### 6.5 Upload Function
- **Upload Dialog**:
  - Drag-and-drop upload support
  - Click to browse files
  - Supports multi-file selection
  - Supports folder recursive upload
  - Displays target path
  - Displays upload file list
- **Upload Methods**:
  - Single file upload
  - Multi-file upload
  - Folder recursive upload (preserves directory structure)

#### 6.6 Delete Function
- **Delete Confirmation Dialog**:
  - Displays delete summary
  - Security confirmation: Requires input "确认" to delete
  - Displays list of files to be deleted

#### 6.7 Create Folder
- **Create Dialog**:
  - Input folder name
  - Auto-translate to English option
  - Displays parent directory path

### Interface Features
- **Responsive Design**: Supports mobile and desktop
- **File List Collapsible**: Saves screen space
- **Video Playlist**: Bottom expandable/collapsible
- **Floating Control Buttons**: Navigation buttons during video playback

---

## 7. 📸 MCP Manager

### Function Description
Manage MCP (Model Context Protocol) functions and resources.

### Function Modules
- **Menu System**: Left menu navigation
- **Content Area**: Dynamically loads MCP-related content
- **Resource Management**: Manage MCP-related resources

### Related APIs (McpV1 Application)
- OCR recognition related APIs
- Screenshot upload and management APIs
- Task distribution queue APIs
- Placeholder image generation APIs

---

## General Functions

### User Authentication
- **Login/Register**: Modal dialog
- **Login Method**: Username/password
- **Registration Requirement**: Requires invitation code
- **Session Management**: Login state persistence

### Interface Layout
- **Sidebar**: Collapsible/expandable
- **Main Content Area**: Dynamically loads different modules
- **Responsive Design**: Adapts to different screen sizes
- **Mobile Support**: Mobile device optimization

### Data Storage
- **LocalStorage**: Browser local storage
- **Stored Content**:
  - API test parameters
  - Request header configuration
  - Tool usage history
  - User preference settings

---

## Technology Stack

- **Backend**: Laravel 12.38.1
- **PHP Version**: 8.4.15
- **Frontend**: Native JavaScript + HTML/CSS
- **Database**: SQLite (multi-database connection support)
- **Authentication**: Laravel Sanctum

---

## Usage Recommendations

1. **API Testing**: Use API Testing Dashboard for quick API debugging
2. **Tool Usage**: Development Tools provides rich online tools without installing additional software
3. **System Monitoring**: System Information to view system status and configuration
4. **Code Management**: Code Browser for online code browsing and editing
5. **Resource Management**: Static Resources to manage media files, supports batch operations

---

## Important Notes

1. **Authentication Requirements**: Some functions (e.g., Code Browser) require login
2. **Data Persistence**: Uses browser LocalStorage, clearing browser data will lose configuration
3. **File Upload**: Static Resources supports large file uploads, pay attention to network stability
4. **API Testing**: Ensure backend service is running normally
5. **System Information**: System Information displays real-time system status, data updates periodically

