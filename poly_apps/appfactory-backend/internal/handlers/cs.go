package handlers

import (
	"appfactory-backend/internal/database"
	"appfactory-backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// CSHandler handles customer service endpoints
type CSHandler struct{}

// NewCSHandler creates a new CS handler
func NewCSHandler() *CSHandler {
	return &CSHandler{}
}

// GetAllCS returns all customer service representatives
func (h *CSHandler) GetAllCS(c *gin.Context) {
	var csList []models.CustomerService
	if err := database.DB.Preload("User").Find(&csList).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, csList)
}

// GetCSByID returns a specific CS
func (h *CSHandler) GetCSByID(c *gin.Context) {
	id := c.Param("id")

	var cs models.CustomerService
	if err := database.DB.Preload("User").First(&cs, "user_id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CS not found"})
		return
	}

	c.JSON(http.StatusOK, cs)
}

// GetMyApps returns apps assigned to current CS
func (h *CSHandler) GetMyApps(c *gin.Context) {
	csID := c.GetString("user_id")

	var assignments []models.CSAppAssignment
	if err := database.DB.Preload("App").Where("cs_id = ?", csID).Find(&assignments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	apps := make([]models.AppInstance, len(assignments))
	for i, assignment := range assignments {
		apps[i] = assignment.App
	}

	c.JSON(http.StatusOK, apps)
}

// GetMyRevenue returns revenue for current CS
func (h *CSHandler) GetMyRevenue(c *gin.Context) {
	csID := c.GetString("user_id")

	var revenues []models.CSAppRevenue
	if err := database.DB.Where("cs_id = ?", csID).Find(&revenues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalRevenue := 0.0
	totalCommission := 0.0
	totalPromotions := 0

	for _, rev := range revenues {
		totalRevenue += rev.Revenue
		totalCommission += rev.Commission
		totalPromotions += rev.Promotions
	}

	c.JSON(http.StatusOK, gin.H{
		"total_revenue":    totalRevenue,
		"total_commission": totalCommission,
		"total_promotions": totalPromotions,
		"details":          revenues,
	})
}

// GetCSPerformance returns performance metrics for a CS
func (h *CSHandler) GetCSPerformance(c *gin.Context) {
	csID := c.Param("id")

	var cs models.CustomerService
	if err := database.DB.Preload("User").First(&cs, "user_id = ?", csID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CS not found"})
		return
	}

	// Get assigned apps
	var assignments []models.CSAppAssignment
	database.DB.Preload("App").Where("cs_id = ?", csID).Find(&assignments)

	// Get revenue data
	var revenues []models.CSAppRevenue
	database.DB.Where("cs_id = ?", csID).Find(&revenues)

	totalRevenue := 0.0
	totalPromotions := 0

	for _, rev := range revenues {
		totalRevenue += rev.Revenue
		totalPromotions += rev.Promotions
	}

	c.JSON(http.StatusOK, gin.H{
		"cs":               cs,
		"assigned_apps":    assignments,
		"total_revenue":    totalRevenue,
		"total_promotions": totalPromotions,
		"revenues":         revenues,
	})
}

// AssignCSToApp assigns CS to an app (many-to-many)
func (h *CSHandler) AssignCSToApp(c *gin.Context) {
	var req models.AssignCSRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Remove existing assignments for this app
	database.DB.Where("app_id = ?", req.AppID).Delete(&models.CSAppAssignment{})

	// Create new assignments
	for _, csID := range req.CSIDs {
		assignment := models.CSAppAssignment{
			CSID:  csID,
			AppID: req.AppID,
		}
		database.DB.Create(&assignment)
	}

	c.JSON(http.StatusOK, gin.H{"message": "CS assigned successfully"})
}

// GetCSRanking returns CS ranking by earnings
func (h *CSHandler) GetCSRanking(c *gin.Context) {
	var csList []models.CustomerService
	if err := database.DB.Preload("User").Order("total_earnings DESC").Find(&csList).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, csList)
}

// UpdateCSStatus updates CS online/offline status
func (h *CSHandler) UpdateCSStatus(c *gin.Context) {
	csID := c.GetString("user_id")
	status := c.PostForm("status")

	var cs models.CustomerService
	if err := database.DB.First(&cs, "user_id = ?", csID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CS not found"})
		return
	}

	cs.Status = status
	database.DB.Save(&cs)

	c.JSON(http.StatusOK, cs)
}
