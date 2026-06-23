package handlers

import (
	"appfactory-backend/internal/database"
	"appfactory-backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// TechHandler handles technical team endpoints
type TechHandler struct{}

// NewTechHandler creates a new tech handler
func NewTechHandler() *TechHandler {
	return &TechHandler{}
}

// GetAllTech returns all technical team members
func (h *TechHandler) GetAllTech(c *gin.Context) {
	var techList []models.TechMember
	if err := database.DB.Preload("User").Find(&techList).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, techList)
}

// GetMyTasks returns tasks assigned to current tech member
func (h *TechHandler) GetMyTasks(c *gin.Context) {
	techID := c.GetString("user_id")

	var requests []models.AppGenerationRequest
	if err := database.DB.Where("assigned_tech_id = ?", techID).Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// GetAppGenerationRequests returns all app generation requests
func (h *TechHandler) GetAppGenerationRequests(c *gin.Context) {
	status := c.Query("status")

	query := database.DB.Model(&models.AppGenerationRequest{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var requests []models.AppGenerationRequest
	if err := query.Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, requests)
}

// UpdateGenerationRequestStatus updates generation request status
func (h *TechHandler) UpdateGenerationRequestStatus(c *gin.Context) {
	id := c.Param("id")
	status := c.PostForm("status")

	var request models.AppGenerationRequest
	if err := database.DB.First(&request, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	request.Status = status
	database.DB.Save(&request)

	c.JSON(http.StatusOK, request)
}

// GetMyApps returns apps created by current tech member
func (h *TechHandler) GetMyApps(c *gin.Context) {
	techID := c.GetString("user_id")

	var apps []models.AppInstance
	if err := database.DB.Where("assigned_tech_id = ?", techID).Find(&apps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, apps)
}

// UpdateTechStatus updates tech member status
func (h *TechHandler) UpdateTechStatus(c *gin.Context) {
	techID := c.GetString("user_id")
	status := c.PostForm("status")

	var tech models.TechMember
	if err := database.DB.First(&tech, "user_id = ?", techID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tech member not found"})
		return
	}

	tech.Status = status
	database.DB.Save(&tech)

	c.JSON(http.StatusOK, tech)
}
