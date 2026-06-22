package main

import (
	"appfactory-backend/internal/database"
	"appfactory-backend/internal/handlers"
	"appfactory-backend/internal/middleware"
	"appfactory-backend/internal/models"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize database
	database.InitDatabase()

	// Create Gin router
	r := gin.Default()

	// Apply CORS middleware
	r.Use(middleware.CORS())

	// Initialize handlers
	authHandler := handlers.NewAuthHandler()
	appHandler := handlers.NewAppHandler()
	csHandler := handlers.NewCSHandler()
	techHandler := handlers.NewTechHandler()
	statsHandler := handlers.NewStatsHandler()

	// Public routes
	public := r.Group("/api/v1")
	{
		// Authentication
		public.POST("/auth/login", authHandler.Login)
		public.POST("/auth/register", authHandler.Register)

		// Public app endpoints (for visitor tracking)
		public.POST("/apps/:id/visit", appHandler.IncrementVisit)
	}

	// Protected routes
	protected := r.Group("/api/v1")
	protected.Use(middleware.AuthMiddleware())
	{
		// Current user
		protected.GET("/auth/me", authHandler.GetCurrentUser)

		// ========== APP ENDPOINTS ==========
		// All roles can view apps
		protected.GET("/apps", appHandler.GetAllApps)
		protected.GET("/apps/:id", appHandler.GetAppByID)
		protected.GET("/apps/:id/stats", appHandler.GetAppStats)

		// ========== ADMIN-ONLY ENDPOINTS ==========
		admin := protected.Group("")
		admin.Use(middleware.RequireRole(models.RoleAdmin))
		{
			// App management
			admin.POST("/apps", appHandler.CreateApp)
			admin.PUT("/apps/:id/status", appHandler.UpdateAppStatus)
			admin.DELETE("/apps/:id", appHandler.DeleteApp)

			// CS management
			admin.GET("/cs", csHandler.GetAllCS)
			admin.GET("/cs/:id", csHandler.GetCSByID)
			admin.GET("/cs/:id/performance", csHandler.GetCSPerformance)
			admin.GET("/cs/ranking", csHandler.GetCSRanking)
			admin.POST("/cs/assign", csHandler.AssignCSToApp)

			// Tech management
			admin.GET("/tech", techHandler.GetAllTech)
			admin.GET("/tech/requests", techHandler.GetAppGenerationRequests)
			admin.PUT("/tech/requests/:id/status", techHandler.UpdateGenerationRequestStatus)

			// Statistics
			admin.GET("/stats/dashboard", statsHandler.GetDashboardStats)
			admin.GET("/stats/daily", statsHandler.GetDailyStats)
			admin.GET("/stats/revenue/apps", statsHandler.GetRevenueByApp)
			admin.GET("/stats/revenue/cs", statsHandler.GetRevenueByCS)
			admin.GET("/stats/revenue/category", statsHandler.GetRevenueByCategory)
			admin.GET("/stats/revenue/matrix", statsHandler.GetCSAppRevenueMatrix)
			admin.GET("/stats/apps/:id/trends", statsHandler.GetAppVisitTrends)
		}

		// ========== CS ENDPOINTS ==========
		cs := protected.Group("")
		cs.Use(middleware.RequireRole(models.RoleCS, models.RoleAdmin))
		{
			cs.GET("/cs/my-apps", csHandler.GetMyApps)
			cs.GET("/cs/my-revenue", csHandler.GetMyRevenue)
			cs.PUT("/cs/status", csHandler.UpdateCSStatus)
		}

		// ========== TECH ENDPOINTS ==========
		tech := protected.Group("")
		tech.Use(middleware.RequireRole(models.RoleTech, models.RoleAdmin))
		{
			tech.GET("/tech/my-tasks", techHandler.GetMyTasks)
			tech.GET("/tech/my-apps", techHandler.GetMyApps)
			tech.PUT("/tech/status", techHandler.UpdateTechStatus)
		}
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Start server
	log.Println("Server starting on :8080...")
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
