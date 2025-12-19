package handlers

import (
	"appfactory-backend/internal/database"
	"appfactory-backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// StatsHandler handles statistics endpoints
type StatsHandler struct{}

// NewStatsHandler creates a new stats handler
func NewStatsHandler() *StatsHandler {
	return &StatsHandler{}
}

// GetDashboardStats returns overall dashboard statistics
func (h *StatsHandler) GetDashboardStats(c *gin.Context) {
	var totalApps int64
	var liveApps int64
	var totalCS int64
	var totalTech int64

	database.DB.Model(&models.AppInstance{}).Count(&totalApps)
	database.DB.Model(&models.AppInstance{}).Where("status = ?", models.StatusLive).Count(&liveApps)
	database.DB.Model(&models.CustomerService{}).Count(&totalCS)
	database.DB.Model(&models.TechMember{}).Count(&totalTech)

	// Calculate total revenue
	var apps []models.AppInstance
	database.DB.Find(&apps)
	totalRevenue := 0.0
	totalVisits := int64(0)
	for _, app := range apps {
		totalRevenue += app.Revenue
		totalVisits += app.Visits
	}

	// Calculate average rating
	var avgRating float64
	database.DB.Model(&models.AppInstance{}).Select("AVG(rating)").Scan(&avgRating)

	c.JSON(http.StatusOK, gin.H{
		"total_apps":    totalApps,
		"live_apps":     liveApps,
		"total_cs":      totalCS,
		"total_tech":    totalTech,
		"total_revenue": totalRevenue,
		"total_visits":  totalVisits,
		"avg_rating":    avgRating,
	})
}

// GetDailyStats returns daily statistics
func (h *StatsHandler) GetDailyStats(c *gin.Context) {
	days := c.DefaultQuery("days", "7")

	var stats []models.DailyStat
	if err := database.DB.Order("date DESC").Limit(7).Find(&stats).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetRevenueByApp returns revenue grouped by app
func (h *StatsHandler) GetRevenueByApp(c *gin.Context) {
	var apps []models.AppInstance
	if err := database.DB.Order("revenue DESC").Limit(10).Find(&apps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, apps)
}

// GetRevenueByCS returns revenue grouped by CS
func (h *StatsHandler) GetRevenueByCS(c *gin.Context) {
	var csList []models.CustomerService
	if err := database.DB.Preload("User").Order("total_earnings DESC").Find(&csList).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, csList)
}

// GetRevenueByCategory returns revenue grouped by category
func (h *StatsHandler) GetRevenueByCategory(c *gin.Context) {
	type CategoryRevenue struct {
		Category models.AppCategory `json:"category"`
		Revenue  float64            `json:"revenue"`
		Count    int64              `json:"count"`
	}

	var results []CategoryRevenue
	database.DB.Model(&models.AppInstance{}).
		Select("category, SUM(revenue) as revenue, COUNT(*) as count").
		Group("category").
		Scan(&results)

	c.JSON(http.StatusOK, results)
}

// GetCSAppRevenueMatrix returns CS-APP revenue matrix
func (h *StatsHandler) GetCSAppRevenueMatrix(c *gin.Context) {
	var revenues []models.CSAppRevenue
	if err := database.DB.Find(&revenues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, revenues)
}

// GetAppVisitTrends returns visit trends for an app
func (h *StatsHandler) GetAppVisitTrends(c *gin.Context) {
	appID := c.Param("id")

	var app models.AppInstance
	if err := database.DB.First(&app, "id = ?", appID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "App not found"})
		return
	}

	// In a real system, you'd query historical visit data
	// For now, return current stats
	c.JSON(http.StatusOK, gin.H{
		"app_id":             app.ID,
		"total_visits":       app.Visits,
		"daily_active_users": app.DailyActiveUsers,
		"revenue":            app.Revenue,
		"monthly_revenue":    app.MonthlyRevenue,
	})
}
