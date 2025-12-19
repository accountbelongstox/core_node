package models

import (
	"time"

	"gorm.io/gorm"
)

// UserRole represents user role types
type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleCS    UserRole = "cs"
	RoleTech  UserRole = "tech"
)

// AppStatus represents app status types
type AppStatus string

const (
	StatusLive       AppStatus = "Live"
	StatusPending    AppStatus = "Pending"
	StatusFailed     AppStatus = "Failed"
	StatusIdle       AppStatus = "Idle"
	StatusGenerating AppStatus = "Generating"
)

// AppCategory represents app category types
type AppCategory string

const (
	CategoryFinance       AppCategory = "Finance"
	CategoryEducation     AppCategory = "Education"
	CategoryHealth        AppCategory = "Health"
	CategoryEntertainment AppCategory = "Entertainment"
	CategoryProductivity  AppCategory = "Productivity"
	CategorySocial        AppCategory = "Social"
	CategoryShopping      AppCategory = "Shopping"
	CategoryTravel        AppCategory = "Travel"
)

// User represents a system user
type User struct {
	gorm.Model
	ID        string   `gorm:"primaryKey" json:"id"`
	Name      string   `gorm:"not null" json:"name"`
	Email     string   `gorm:"unique;not null" json:"email"`
	Password  string   `gorm:"not null" json:"-"`
	Role      UserRole `gorm:"not null" json:"role"`
	Avatar    string   `json:"avatar"`
	Phone     string   `json:"phone"`
	LastLogin *time.Time `json:"last_login"`
}

// CustomerService extends User for CS representatives
type CustomerService struct {
	UserID         string  `gorm:"primaryKey" json:"user_id"`
	User           User    `gorm:"foreignKey:UserID" json:"user"`
	Status         string  `json:"status"` // Online, Offline
	TotalEarnings  float64 `json:"total_earnings"`
	CommissionRate float64 `json:"commission_rate"` // Percentage
}

// TechMember extends User for technical team
type TechMember struct {
	UserID         string `gorm:"primaryKey" json:"user_id"`
	User           User   `gorm:"foreignKey:UserID" json:"user"`
	Specialization string `json:"specialization"` // Frontend, Backend, Full Stack, DevOps
	AppsGenerated  int    `json:"apps_generated"`
	Status         string `json:"status"` // Available, Busy, Offline
}

// AppInstance represents an application
type AppInstance struct {
	gorm.Model
	ID               string      `gorm:"primaryKey" json:"id"`
	Name             string      `gorm:"not null" json:"name"`
	Status           AppStatus   `json:"status"`
	Category         AppCategory `json:"category"`
	Visits           int64       `json:"visits"`
	Revenue          float64     `json:"revenue"`
	MonthlyRevenue   float64     `json:"monthly_revenue"`
	DailyActiveUsers int64       `json:"daily_active_users"`
	Description      string      `json:"description"`
	AssignedTechID   string      `json:"assigned_tech_id"`
	Features         string      `gorm:"type:text" json:"features"` // JSON string
	TargetAudience   string      `json:"target_audience"`
	LaunchDate       *time.Time  `json:"launch_date"`
	Rating           float64     `json:"rating"`
}

// CSAppAssignment represents many-to-many relationship between CS and Apps
type CSAppAssignment struct {
	gorm.Model
	CSID  string `gorm:"not null" json:"cs_id"`
	AppID string `gorm:"not null" json:"app_id"`
	CS    CustomerService `gorm:"foreignKey:CSID;references:UserID" json:"cs"`
	App   AppInstance     `gorm:"foreignKey:AppID" json:"app"`
}

// CSAppRevenue tracks revenue per CS per App
type CSAppRevenue struct {
	gorm.Model
	ID         string  `gorm:"primaryKey" json:"id"`
	CSID       string  `gorm:"not null" json:"cs_id"`
	AppID      string  `gorm:"not null" json:"app_id"`
	Revenue    float64 `json:"revenue"`
	Commission float64 `json:"commission"`
	Promotions int     `json:"promotions"`
}

// DailyStat represents daily statistics
type DailyStat struct {
	gorm.Model
	Date        string `gorm:"uniqueIndex" json:"date"`
	Visits      int64  `json:"visits"`
	Revenue     float64 `json:"revenue"`
	NewApps     int    `json:"new_apps"`
	ActiveUsers int64  `json:"active_users"`
}

// AppGenerationRequest represents a request to generate a new app
type AppGenerationRequest struct {
	gorm.Model
	ID                      string      `gorm:"primaryKey" json:"id"`
	Name                    string      `gorm:"not null" json:"name"`
	Category                AppCategory `json:"category"`
	Description             string      `json:"description"`
	Features                string      `gorm:"type:text" json:"features"` // JSON string
	TargetAudience          string      `json:"target_audience"`
	RequestedBy             string      `json:"requested_by"`
	Status                  string      `json:"status"` // pending, in_progress, completed, failed
	AssignedTechID          string      `json:"assigned_tech_id"`
	EstimatedCompletionDate *time.Time  `json:"estimated_completion_date"`
	CompletionDate          *time.Time  `json:"completion_date"`
}

// LoginRequest for authentication
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse contains JWT token and user info
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// CreateAppRequest for creating new apps
type CreateAppRequest struct {
	Name           string      `json:"name" binding:"required"`
	Category       AppCategory `json:"category" binding:"required"`
	Description    string      `json:"description"`
	Features       []string    `json:"features"`
	TargetAudience string      `json:"target_audience"`
	AssignedTechID string      `json:"assigned_tech_id"`
}

// AssignCSRequest for assigning CS to apps
type AssignCSRequest struct {
	AppID string   `json:"app_id" binding:"required"`
	CSIDs []string `json:"cs_ids" binding:"required"`
}

// UpdateAppStatusRequest for updating app status
type UpdateAppStatusRequest struct {
	Status AppStatus `json:"status" binding:"required"`
}
