# GoFrame Backend Architecture

## Overview

This project follows GoFrame's standard **layered architecture** pattern with **centralized data access**. All database queries are unified in the DAO layer, eliminating scattered query code throughout the application.

## Architecture Layers

```
┌─────────────────────────────────────────────┐
│            HTTP Request                     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         API Layer (api/)                    │
│  - Request/Response definitions             │
│  - Auto-routing with g.Meta tags           │
│  - Auto-validation with v tags             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│    Controller Layer (internal/controller/)  │
│  - Receives requests                        │
│  - Calls Logic layer                        │
│  - Returns responses                        │
│  - NO database queries                      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│    Logic Layer (internal/logic/)            │
│  - Business logic processing                │
│  - Calls DAO layer for data                 │
│  - Orchestrates multiple DAOs               │
│  - NO direct database access                │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│    DAO Layer (internal/dao/)                │
│  ✅ UNIFIED DATA ACCESS CENTER              │
│  - All database queries centralized here    │
│  - CRUD operations                          │
│  - Complex queries                          │
│  - Query reusability                        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│    Entity Layer (internal/model/entity/)    │
│  - Data structures                          │
│  - ORM mappings                             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│         Database (SQLite)                   │
└─────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. API Layer (`api/`)

**Purpose:** Define request/response contracts

**Files:**
- `api/auth.go` - Authentication endpoints
- `api/app.go` - Application endpoints
- `api/cs.go` - Customer service endpoints
- `api/tech.go` - Technical team endpoints
- `api/stats.go` - Statistics endpoints

**Example:**
```go
type LoginReq struct {
    g.Meta   `path:"/auth/login" method:"post" tags:"Auth" summary:"User login"`
    Email    string `json:"email" v:"required|email" dc:"Email address"`
    Password string `json:"password" v:"required|min-length:6" dc:"Password"`
}

type LoginRes struct {
    Token string       `json:"token" dc:"JWT token"`
    User  *entity.User `json:"user" dc:"User information"`
}
```

**Key Features:**
- ✅ Declarative routing with `g.Meta`
- ✅ Auto-validation with `v` tags
- ✅ API documentation tags

---

### 2. Controller Layer (`internal/controller/`)

**Purpose:** Handle HTTP requests and responses

**Files:**
- `controller/auth.go` - Authentication controller
- `controller/app.go` - Application controller
- `controller/cs.go` - CS controller
- `controller/tech.go` - Tech controller
- `controller/stats.go` - Stats controller

**Responsibilities:**
- ✅ Receive validated requests
- ✅ Call logic layer
- ✅ Return structured responses
- ❌ **NO** database queries
- ❌ **NO** business logic

**Example:**
```go
type App struct {
    logic *logic.App  // Only depends on logic layer
}

func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (res *api.GetAllAppsRes, err error) {
    // Call logic layer - NO database code here
    apps, err := c.logic.GetAllApps(ctx, req.Status, req.Category, req.Search)
    if err != nil {
        return nil, err
    }

    return &api.GetAllAppsRes{
        Apps: apps,
    }, nil
}
```

**Before Refactoring (BAD):**
```go
// ❌ Controller directly accessing database - scattered queries
func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (res *api.GetAllAppsRes, err error) {
    model := g.DB().Model("app_instance")  // ❌ Database query in controller
    if req.Status != "" {
        model = model.Where("status", req.Status)
    }
    var apps []*entity.AppInstance
    err = model.Scan(&apps)
    // ...
}
```

**After Refactoring (GOOD):**
```go
// ✅ Controller only calls logic layer
func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (res *api.GetAllAppsRes, err error) {
    apps, err := c.logic.GetAllApps(ctx, req.Status, req.Category, req.Search)
    // ...
}
```

---

### 3. Logic Layer (`internal/logic/`)

**Purpose:** Business logic processing

**Files:**
- `logic/auth.go` - Authentication logic
- `logic/app.go` - Application logic
- `logic/cs.go` - CS management logic
- `logic/tech.go` - Tech management logic
- `logic/stats.go` - Statistics logic

**Responsibilities:**
- ✅ Business rules enforcement
- ✅ Data orchestration
- ✅ Calling multiple DAOs
- ✅ Data transformation
- ❌ **NO** direct database access

**Example:**
```go
type App struct {
    appDao        *dao.App           // Depends on DAO layer
    assignmentDao *dao.CSAssignment
    revenueDao    *dao.CSRevenue
}

func (l *App) GetAppStats(ctx context.Context, id string) (*entity.AppInstance, []*entity.CSAppAssignment, []*entity.CSAppRevenue, error) {
    // Orchestrate multiple DAO calls
    app, err := l.appDao.FindByUid(ctx, id)
    if err != nil || app.Id == 0 {
        return nil, nil, nil, gerror.New("Application not found")
    }

    assignments, _ := l.assignmentDao.FindByAppId(ctx, id)
    revenues, _ := l.revenueDao.FindByAppId(ctx, id)

    return app, assignments, revenues, nil
}
```

---

### 4. DAO Layer (`internal/dao/`) - **UNIFIED DATA ACCESS CENTER**

**Purpose:** Centralized database operations

**Files:**
- `dao/user.go` - User table operations
- `dao/app.go` - App table operations
- `dao/cs_assignment.go` - CS assignment operations
- `dao/cs_revenue.go` - Revenue operations

**Responsibilities:**
- ✅ **ALL database queries**
- ✅ CRUD operations
- ✅ Complex queries
- ✅ Query reusability
- ✅ Single source of truth

**Example:**
```go
type App struct{}

// FindAll finds all apps with filters
func (d *App) FindAll(ctx context.Context, status, category, search string) ([]*entity.AppInstance, error) {
    model := g.DB().Model("app_instance")

    if status != "" {
        model = model.Where("status", status)
    }
    if category != "" {
        model = model.Where("category", category)
    }
    if search != "" {
        model = model.WhereLike("name", "%"+search+"%")
    }

    var apps []*entity.AppInstance
    err := model.Scan(&apps)
    return apps, err
}

// FindByUid finds app by UID
func (d *App) FindByUid(ctx context.Context, uid string) (*entity.AppInstance, error) {
    var app entity.AppInstance
    err := g.DB().Model("app_instance").Where("uid", uid).Scan(&app)
    return &app, err
}

// SumRevenue sums total revenue
func (d *App) SumRevenue(ctx context.Context) (float64, error) {
    result, err := g.DB().Model("app_instance").Fields("SUM(revenue) as total").One()
    if err != nil || result.IsEmpty() {
        return 0, err
    }
    return result["total"].Float64(), nil
}
```

---

### 5. Entity Layer (`internal/model/entity/`)

**Purpose:** Data structures and ORM mappings

**Files:**
- `entity/user.go` - User entity
- `entity/app.go` - All app-related entities

**Example:**
```go
type User struct {
    Id        uint        `json:"id" orm:"id,primary" description:"User ID"`
    Uid       string      `json:"uid" orm:"uid,unique" description:"User unique identifier"`
    Name      string      `json:"name" orm:"name" description:"User name"`
    Email     string      `json:"email" orm:"email,unique" description:"Email address"`
    Role      string      `json:"role" orm:"role" description:"User role"`
    CreatedAt *gtime.Time `json:"createdAt" orm:"created_at" description:"Created time"`
}
```

---

## Key Benefits of Unified Data Access

### ✅ **1. Centralized Query Management**

**Before:**
```
❌ Scattered queries across the codebase
controller/auth.go:         g.DB().Model("user").Where("email", email)...
controller/cs.go:           g.DB().Model("user").Where("role", "cs")...
controller/stats.go:        g.DB().Model("user").Where("role", "cs")...
```

**After:**
```
✅ All queries centralized in DAO layer
dao/user.go:
  - FindByEmail()
  - FindByRole()
  - FindByUid()
  - Count()
```

### ✅ **2. Query Reusability**

**Example:** Finding CS members

```go
// Used in multiple places:
// - CS controller: GetAllCS()
// - Stats controller: GetCSPerformance()
// - Logic layer: CS management

// ✅ Single implementation in DAO
func (d *User) FindByRole(ctx context.Context, role string) ([]*entity.User, error) {
    var users []*entity.User
    err := g.DB().Model("user").Where("role", role).Scan(&users)
    return users, err
}
```

### ✅ **3. Easier Testing**

```go
// Mock DAO layer for unit testing
type MockUserDAO struct {
    FindByEmailFunc func(ctx context.Context, email string) (*entity.User, error)
}

func TestLogin(t *testing.T) {
    mockDAO := &MockUserDAO{
        FindByEmailFunc: func(ctx context.Context, email string) (*entity.User, error) {
            return &entity.User{Email: email}, nil
        },
    }
    // Test logic without database
}
```

### ✅ **4. Consistent Error Handling**

```go
// DAO layer handles database errors consistently
func (d *User) FindByEmail(ctx context.Context, email string) (*entity.User, error) {
    var user entity.User
    err := g.DB().Model("user").Where("email", email).Scan(&user)
    if err != nil {
        return nil, err  // Consistent error handling
    }
    return &user, nil
}
```

### ✅ **5. Easy Query Optimization**

```go
// Optimize query in ONE place - affects all usages
func (d *App) FindAll(ctx context.Context, status, category, search string) ([]*entity.AppInstance, error) {
    model := g.DB().Model("app_instance").
        Cache(gdb.CacheOption{Duration: time.Minute, Name: "app_list"}).  // Add caching
        Fields("id", "uid", "name", "status", "category")  // Select specific fields

    // ... rest of implementation
}
```

---

## Data Flow Example

### Request: GET /api/v1/apps?status=Live

```
1. HTTP Request
   ↓
2. API Layer (api/app.go)
   - Validates request
   - status: "Live" ✓
   ↓
3. Controller Layer (controller/app.go)
   apps, err := c.logic.GetAllApps(ctx, "Live", "", "")
   ↓
4. Logic Layer (logic/app.go)
   apps, err := l.appDao.FindAll(ctx, "Live", "", "")
   ↓
5. DAO Layer (dao/app.go) ✅ QUERY HAPPENS HERE
   model := g.DB().Model("app_instance")
   model = model.Where("status", "Live")
   err := model.Scan(&apps)
   ↓
6. Database
   SELECT * FROM app_instance WHERE status = 'Live'
   ↓
7. Return up the stack
   DAO → Logic → Controller → HTTP Response
```

---

## Code Statistics

### Before Refactoring:
```
Controllers: ~800 lines (with database queries)
Logic:       0 lines (no logic layer)
DAO:         0 lines (no DAO layer)
Total:       ~800 lines
```

### After Refactoring:
```
Controllers: ~300 lines (-63% cleaner!)
Logic:       ~450 lines (business logic)
DAO:         ~550 lines (all queries)
Total:       ~1300 lines
```

**Trade-off:**
- ✅ More organized code
- ✅ Better separation of concerns
- ✅ Easier to maintain and test
- ⚠️  More files and lines of code
- ⚠️  Slightly more boilerplate

---

## File Structure

```
appfactory-goframe/
├── api/                          # API definitions
│   ├── auth.go                  # Auth endpoints
│   ├── app.go                   # App endpoints
│   ├── cs.go                    # CS endpoints
│   ├── tech.go                  # Tech endpoints
│   └── stats.go                 # Stats endpoints
│
├── internal/
│   ├── controller/              # Controllers (HTTP handlers)
│   │   ├── auth.go
│   │   ├── app.go
│   │   ├── cs.go
│   │   ├── tech.go
│   │   └── stats.go
│   │
│   ├── logic/                   # Business logic
│   │   ├── auth.go
│   │   ├── app.go
│   │   ├── cs.go
│   │   ├── tech.go
│   │   └── stats.go
│   │
│   ├── dao/                     # ✅ UNIFIED DATA ACCESS
│   │   ├── user.go             # User queries
│   │   ├── app.go              # App queries
│   │   ├── cs_assignment.go    # Assignment queries
│   │   └── cs_revenue.go       # Revenue queries
│   │
│   └── model/entity/            # Data entities
│       ├── user.go
│       └── app.go
│
└── main.go                      # Application entry
```

---

## Best Practices

### ✅ DO:

1. **All queries in DAO layer**
```go
// ✅ GOOD
func (l *App) GetAllApps(ctx context.Context, status string) ([]*entity.AppInstance, error) {
    return l.appDao.FindAll(ctx, status, "", "")
}
```

2. **Business logic in Logic layer**
```go
// ✅ GOOD
func (l *Auth) Login(ctx context.Context, email, password string) (*entity.User, string, error) {
    user, err := l.userDao.FindByEmail(ctx, email)
    // Verify password
    // Generate token
    return user, token, nil
}
```

3. **Simple controllers**
```go
// ✅ GOOD
func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (*api.GetAllAppsRes, error) {
    apps, err := c.logic.GetAllApps(ctx, req.Status, req.Category, req.Search)
    return &api.GetAllAppsRes{Apps: apps}, err
}
```

### ❌ DON'T:

1. **Database queries in controllers**
```go
// ❌ BAD
func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (*api.GetAllAppsRes, error) {
    var apps []*entity.AppInstance
    err := g.DB().Model("app_instance").Scan(&apps)  // ❌ Direct DB access
    return &api.GetAllAppsRes{Apps: apps}, err
}
```

2. **Business logic in controllers**
```go
// ❌ BAD
func (c *Auth) Login(ctx context.Context, req *api.LoginReq) (*api.LoginRes, error) {
    // Password verification in controller  // ❌ Business logic here
    // Token generation in controller        // ❌ Business logic here
}
```

3. **Database queries in logic layer**
```go
// ❌ BAD
func (l *App) GetAllApps(ctx context.Context, status string) ([]*entity.AppInstance, error) {
    var apps []*entity.AppInstance
    err := g.DB().Model("app_instance").Where("status", status).Scan(&apps)  // ❌ Direct DB access
    return apps, err
}
```

---

## Summary

### Key Achievements:

1. ✅ **Unified Data Access** - All database queries centralized in DAO layer
2. ✅ **Clean Separation** - Controller → Logic → DAO → Database
3. ✅ **No Scattered Queries** - Easy to find and modify queries
4. ✅ **Reusable Code** - Same queries used across different features
5. ✅ **Easy Testing** - Mock DAO layer for unit tests
6. ✅ **Standard GoFrame** - Follows GoFrame best practices

### This Architecture Solves:

- ❌ **Before:** Database queries scattered everywhere
- ✅ **After:** All queries in DAO layer

- ❌ **Before:** Duplicate query logic
- ✅ **After:** Reusable DAO methods

- ❌ **Before:** Hard to test
- ✅ **After:** Easy to mock DAO layer

- ❌ **Before:** Mixed responsibilities
- ✅ **After:** Clear layer separation

---

**Result:** A clean, maintainable, and testable codebase following GoFrame standards with centralized data access! 🎉
