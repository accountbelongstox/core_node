# AppFactory GoFrame Backend

A complete RESTful API backend built with GoFrame framework v2.6.0 and SQLite database.

## Project Structure

```
appfactory-goframe/
├── manifest/
│   └── config/
│       └── config.yaml          # Application configuration
├── api/                         # API definitions (auto-routing)
│   ├── auth.go
│   ├── app.go
│   ├── cs.go
│   ├── tech.go
│   └── stats.go
├── internal/
│   ├── controller/              # HTTP request handlers
│   │   ├── auth.go
│   │   ├── app.go
│   │   ├── cs.go
│   │   ├── tech.go
│   │   └── stats.go
│   ├── logic/                   # Business logic layer
│   │   ├── auth.go
│   │   ├── app.go
│   │   ├── cs.go
│   │   ├── tech.go
│   │   └── stats.go
│   ├── dao/                     # ✅ Unified data access layer
│   │   ├── user.go             # All user queries
│   │   ├── app.go              # All app queries
│   │   ├── cs_assignment.go    # Assignment queries
│   │   └── cs_revenue.go       # Revenue queries
│   └── model/
│       └── entity/              # Data models
│           ├── user.go
│           └── app.go
├── main.go                      # Application entry point
├── go.mod                       # Go module dependencies
├── README.md                    # This file
├── ARCHITECTURE.md              # Detailed architecture guide
└── CONSISTENCY_CHECK.md         # Code consistency report
```

## Prerequisites

- **Go 1.21+** - [Download](https://golang.org/dl/)
- **Git** (optional)

## Installation

### 1. Install Dependencies

```bash
cd appfactory-goframe
go mod tidy
```

This will download all required dependencies:
- GoFrame v2.6.0
- JWT library (golang-jwt/jwt/v5)
- bcrypt (golang.org/x/crypto/bcrypt)

### 2. Configure Application

Edit `manifest/config/config.yaml` to customize:

```yaml
server:
  address: ":8080"              # Change port if needed

database:
  default:
    link: "sqlite::@file(appfactory.db)"  # SQLite database file

jwt:
  secret: "your-super-secret-key-change-in-production"  # CHANGE THIS!
  expire: 86400                  # Token expiry (24 hours)
```

## Running the Application

### Development Mode

```bash
go run main.go
```

The server will start on `http://localhost:8080` (or your configured port).

### Production Build

```bash
# Build executable
go build -o appfactory main.go

# Run
./appfactory         # Linux/Mac
appfactory.exe       # Windows
```

## API Endpoints

### Authentication (Public)

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/me` - Get current user (protected)

### Applications (Protected)

- `GET /api/v1/apps` - Get all apps (with filters)
- `GET /api/v1/apps/:id` - Get app by ID
- `POST /api/v1/apps` - Create new app
- `PUT /api/v1/apps/:id/status` - Update app status
- `DELETE /api/v1/apps/:id` - Delete app
- `GET /api/v1/apps/:id/stats` - Get app statistics
- `POST /api/v1/apps/:id/visit` - Increment visit count

### Customer Service (Protected)

- `GET /api/v1/cs` - Get all CS members
- `POST /api/v1/cs/assign` - Assign CS to app
- `POST /api/v1/cs/remove` - Remove CS from app
- `GET /api/v1/cs/:csId/apps` - Get apps for CS
- `GET /api/v1/cs/:csId/revenue` - Get CS revenue
- `PUT /api/v1/cs/revenue` - Update CS revenue

### Technical Team (Protected)

- `GET /api/v1/tech` - Get all tech members
- `GET /api/v1/tech/:techId/apps` - Get apps for tech
- `POST /api/v1/tech/assign` - Assign tech to app
- `GET /api/v1/tech/:techId/workload` - Get tech workload

### Statistics (Protected)

- `GET /api/v1/stats/dashboard` - Dashboard statistics
- `GET /api/v1/stats/revenue` - Revenue statistics
- `GET /api/v1/stats/cs-performance` - CS performance
- `GET /api/v1/stats/tech-performance` - Tech performance

### Health Check (Public)

- `GET /health` - Service health status

## Testing the API

### 1. Register a User

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "password": "password123",
    "role": "admin",
    "phone": "1234567890"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

Response will include a JWT token:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

### 3. Use Protected Endpoints

```bash
# Get all apps (requires authentication)
curl -X GET http://localhost:8080/api/v1/apps \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Create an Application

```bash
curl -X POST http://localhost:8080/api/v1/apps \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New App",
    "category": "Finance",
    "description": "A finance management app",
    "features": ["budgeting", "expense tracking"],
    "targetAudience": "Young professionals",
    "assignedTechId": "tech-uid-123"
  }'
```

## Architecture

This project follows GoFrame's standard **layered architecture** with **unified data access**:

```
HTTP Request
    ↓
API Layer (Validation)
    ↓
Controller Layer (Request Handling)
    ↓
Logic Layer (Business Logic)
    ↓
DAO Layer (✅ ALL Database Queries)
    ↓
Database (SQLite)
```

### Key Benefits:

1. **✅ Unified Data Access** - All database queries centralized in DAO layer
2. **✅ Clean Separation** - Clear responsibility for each layer
3. **✅ No Scattered Queries** - Easy to find and modify all queries
4. **✅ Reusable Code** - DAO methods used across different features
5. **✅ Easy Testing** - Mock DAO layer for unit tests

**Example:**
```go
// Controller - handles request/response
func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (*api.GetAllAppsRes, error) {
    apps, err := c.logic.GetAllApps(ctx, req.Status, req.Category, req.Search)
    return &api.GetAllAppsRes{Apps: apps}, err
}

// Logic - business logic
func (l *App) GetAllApps(ctx context.Context, status, category, search string) ([]*entity.AppInstance, error) {
    return l.appDao.FindAll(ctx, status, category, search)
}

// DAO - ✅ ALL database queries here
func (d *App) FindAll(ctx context.Context, status, category, search string) ([]*entity.AppInstance, error) {
    model := g.DB().Model("app_instance")
    if status != "" {
        model = model.Where("status", status)
    }
    // ... rest of query
}
```

👉 **See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture guide**

## GoFrame Features Used

### 1. Auto-Routing with g.Meta

API endpoints are automatically registered using `g.Meta` tags:

```go
type LoginReq struct {
    g.Meta   `path:"/auth/login" method:"post" tags:"Auth" summary:"User login"`
    Email    string `json:"email" v:"required|email"`
    Password string `json:"password" v:"required|min-length:6"`
}
```

### 2. Auto-Validation

Request validation is automatic using `v` tags:

```go
Email string `json:"email" v:"required|email"`  // Validates email format
```

### 3. Built-in ORM (GDB)

Database operations with GoFrame's ORM:

```go
g.DB().Model("user").Where("email", email).Scan(&user)
```

### 4. YAML Configuration

All configuration in `config.yaml` - no hardcoded values.

### 5. Middleware Support

CORS and JWT authentication middleware:

```go
s.Use(MiddlewareCORS)
group.Middleware(MiddlewareAuth)
```

## Database Schema

The application uses SQLite with the following main tables:

- **user** - User accounts (admin, cs, tech roles)
- **app_instance** - Application instances
- **cs_app_assignment** - Many-to-many CS-App relationships
- **cs_app_revenue** - Revenue tracking per CS per App

GoFrame will auto-create tables based on entity definitions on first run.

## Development Tips

### Enable Debug Mode

In `config.yaml`:

```yaml
database:
  default:
    debug: true  # Shows all SQL queries in console
```

### View Route Map

Set in `config.yaml`:

```yaml
server:
  dumpRouterMap: true  # Prints all routes on startup
```

### Logs

Logs are stored in `logs/` directory. Configure in `config.yaml`:

```yaml
logger:
  path: "logs"
  level: "all"  # all, debug, info, warn, error
  stdout: true  # Also print to console
```

## Comparison with Gin

See `GIN_VS_GOFRAME_COMPARISON.md` for detailed comparison.

**Key Advantages:**
- ✅ 25% less code
- ✅ Auto-validation with `v` tags
- ✅ Auto-routing with `g.Meta` tags
- ✅ Built-in ORM (no external GORM)
- ✅ YAML configuration management
- ✅ Better structured architecture

**Trade-offs:**
- ⚠️ Slightly lower performance (~30-40% vs Gin)
- ⚠️ Smaller community/ecosystem
- ⚠️ More opinionated structure

## Troubleshooting

### Port Already in Use

Change port in `config.yaml`:

```yaml
server:
  address: ":8081"  # Use different port
```

### Database Locked

SQLite allows only one write at a time. For high concurrency, consider PostgreSQL/MySQL.

### JWT Token Invalid

Ensure you've set a secure JWT secret in `config.yaml` and you're passing the token correctly:

```
Authorization: Bearer YOUR_TOKEN
```

## Production Deployment

### 1. Change JWT Secret

```yaml
jwt:
  secret: "use-a-long-random-secret-here-at-least-32-chars"
```

### 2. Build for Production

```bash
CGO_ENABLED=1 go build -ldflags="-s -w" -o appfactory main.go
```

### 3. Use Environment Variables (Optional)

GoFrame supports environment variable overrides:

```bash
export GF_SERVER_ADDRESS=":8080"
export GF_JWT_SECRET="production-secret"
./appfactory
```

### 4. Run as Service (Linux)

Create systemd service file `/etc/systemd/system/appfactory.service`:

```ini
[Unit]
Description=AppFactory GoFrame Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/appfactory
ExecStart=/opt/appfactory/appfactory
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable appfactory
sudo systemctl start appfactory
```

## License

MIT License - see LICENSE file for details

## Support

For issues or questions about GoFrame, see:
- GoFrame Documentation: https://goframe.org/
- GoFrame GitHub: https://github.com/gogf/gf
