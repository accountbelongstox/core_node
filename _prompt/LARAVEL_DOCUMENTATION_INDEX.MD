# Laravel Documentation Index

> **Description**: This document is an index of Laravel-related prompt documents. Each document has a different theme and is kept independent for easy lookup and maintenance.
> **Last Updated**: 2025-01-XX

## Document List

### 1. Web Interface and Functional Modules

#### `LARAVEL-WEB-功能模块文档.md`
- **Theme**: Laravel API Debug Interface Functional Modules
- **Content**: Detailed descriptions of API testing dashboard, system management, code browsing, resource management, and other modules
- **Access URL**: `http://192.168.50.2:9000/#`

#### `LARAVEL-WEB-菜单功能详细描述.md`
- **Theme**: Laravel API Debug Interface Menu Function Detailed Description
- **Content**: Detailed descriptions of API testing dashboard, app selector, API search, request header management, and other functions
- **Access URL**: `http://192.168.50.2:9000/#`

#### `LARAVEL_WEB_STATIC_RESOURCE_MANAGEMENT.MD`
- **Theme**: Static Resource Management Function
- **Content**: Media Browser, file upload, resource browsing, sorting, and other functions
- **Related**: API endpoints, Mock data, endpoint definition center

#### `laravelWebDashboard.md`
- **Theme**: Laravel Web Dashboard
- **Content**: Dashboard-related functions and endpoint usage

### 2. System Management and Services

#### `cerbot_by_laravel.txt`
- **Theme**: Certbot Certificate Management (via Laravel)
- **Content**: 
  - ServerManagerV1 App analysis
  - Nginx and Certbot service management
  - Domain certificate application and renewal
  - DNS configuration (DNSPod)
  - Domain extension (si/sz/local/api prefixes)
  - Certificate JSON database management
  - Website JSON database management

#### `LARAVEL远程任务系统调用.md`
- **Theme**: Laravel Global Task System
- **Content**:
  - GlobalTask table structure
  - Laravel and Python task integration
  - Task creation, submission, callback
  - OctaneTimerService timer
  - FastAPI service integration

### 3. Application Development

#### `LARAVEL_QY_BACKEND_DESIGN.MD`
- **Theme**: QY APP Backend Design
- **Content**: QY application backend development specifications and design

---

## Quick Lookup Guide

### Search by Function

- **API Testing and Debugging**: 
  - `LARAVEL-WEB-功能模块文档.md`
  - `LARAVEL-WEB-菜单功能详细描述.md`
  - `laravelWebDashboard.md`

- **Static Resource Management**: 
  - `LARAVEL_WEB_STATIC_RESOURCE_MANAGEMENT.MD`

- **Server Management**: 
  - `cerbot_by_laravel.txt`

- **Task System**: 
  - `LARAVEL远程任务系统调用.md`

- **Application Development**: 
  - `LARAVEL_QY_BACKEND_DESIGN.MD`

### Search by Technology Stack

- **Web Interface Development**: `LARAVEL-WEB-*.md`
- **Certificate Management**: `cerbot_by_laravel.txt`
- **Task Queue**: `LARAVEL远程任务系统调用.md`
- **Application Design**: `Laravel后端QY设计.md`

---

## Related Specification Documents

The following documents are not in the `_prompt` directory but should be referenced during development:

- `poly_apps/laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md` - Laravel development specifications
- `development-guides/NODE_NCORE_GUIDE.md` - NCore integration guide

---

## Important Notes

1. **Document Independence**: Each document has a different theme and is kept independent for maintenance
2. **Version Updates**: Documents may be updated independently, pay attention to version consistency
3. **Cross-references**: Some documents may involve the same functionality, pay attention to viewing related documents

---

## Document Maintenance

- When adding new Laravel-related prompt documents, please update this index
- When deleting documents, please update the index simultaneously
- When renaming documents, please update the file name in the index

