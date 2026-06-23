package handlers

import (
	"appfactory-backend/internal/database"
	"appfactory-backend/internal/models"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AppHandler handles app-related endpoints
type AppHandler struct{}

// NewAppHandler creates a new app handler
func NewAppHandler() *AppHandler {
	return &AppHandler{}
}

// GetAllApps returns all apps with optional filtering
func (h *AppHandler) GetAllApps(c *gin.Context) {
	status := c.Query("status")
	category := c.Query("category")
	search := c.Query("search")

	query := database.DB.Model(&models.AppInstance{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}

	var apps []models.AppInstance
	if err := query.Find(&apps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, apps)
}

// GetAppByID returns a specific app
func (h *AppHandler) GetAppByID(c *gin.Context) {
	id := c.Param("id")

	var app models.AppInstance
	if err := database.DB.First(&app, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "App not found"})
		return
	}

	c.JSON(http.StatusOK, app)
}

// CreateApp creates a new app
func (h *AppHandler) CreateApp(c *gin.Context) {
	var req models.CreateAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert features to JSON string
	featuresJSON, _ := json.Marshal(req.Features)

	app := models.AppInstance{
		ID:               uuid.New().String(),
		Name:             req.Name,
		Category:         req.Category,
		Description:      req.Description,
		Features:         string(featuresJSON),
		TargetAudience:   req.TargetAudience,
		AssignedTechID:   req.AssignedTechID,
		Status:           models.StatusGenerating,
		Visits:           0,
		Revenue:          0,
		MonthlyRevenue:   0,
		DailyActiveUsers: 0,
	}

	if err := database.DB.Create(&app).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Create APP generation request
	request := models.AppGenerationRequest{
		ID:             uuid.New().String(),
		Name:           req.Name,
		Category:       req.Category,
		Description:    req.Description,
		Features:       string(featuresJSON),
		TargetAudience: req.TargetAudience,
		RequestedBy:    c.GetString("user_id"),
		Status:         "in_progress",
		AssignedTechID: req.AssignedTechID,
	}

	database.DB.Create(&request)

	c.JSON(http.StatusCreated, app)
}

// UpdateAppStatus updates app status
func (h *AppHandler) UpdateAppStatus(c *gin.Context) {
	id := c.Param("id")

	var req models.UpdateAppStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var app models.AppInstance
	if err := database.DB.First(&app, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "App not found"})
		return
	}

	app.Status = req.Status
	if req.Status == models.StatusLive && app.LaunchDate == nil {
		now := time.Now()
		app.LaunchDate = &now
	}

	database.DB.Save(&app)

	c.JSON(http.StatusOK, app)
}

// DeleteApp deletes an app
func (h *AppHandler) DeleteApp(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.AppInstance{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "App deleted successfully"})
}

// GetAppStats returns app statistics
func (h *AppHandler) GetAppStats(c *gin.Context) {
	id := c.Param("id")

	var app models.AppInstance
	if err := database.DB.First(&app, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "App not found"})
		return
	}

	// Get assigned CS
	var assignments []models.CSAppAssignment
	database.DB.Preload("CS.User").Where("app_id = ?", id).Find(&assignments)

	// Get revenue data
	var revenues []models.CSAppRevenue
	database.DB.Where("app_id = ?", id).Find(&revenues)

	c.JSON(http.StatusOK, gin.H{
		"app":         app,
		"assignments": assignments,
		"revenues":    revenues,
	})
}

// IncrementVisit increments app visit count
func (h *AppHandler) IncrementVisit(c *gin.Context) {
	id := c.Param("id")

	var app models.AppInstance
	if err := database.DB.First(&app, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "App not found"})
		return
	}

	app.Visits++
	database.DB.Save(&app)

	c.JSON(http.StatusOK, gin.H{"visits": app.Visits})
}
