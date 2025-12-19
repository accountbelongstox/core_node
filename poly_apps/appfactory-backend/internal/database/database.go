package database

import (
	"appfactory-backend/internal/models"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDatabase initializes the database connection
func InitDatabase() {
	var err error

	// Use SQLite for simplicity, can be replaced with PostgreSQL/MySQL
	DB, err = gorm.Open(sqlite.Open("appfactory.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate all models
	err = DB.AutoMigrate(
		&models.User{},
		&models.CustomerService{},
		&models.TechMember{},
		&models.AppInstance{},
		&models.CSAppAssignment{},
		&models.CSAppRevenue{},
		&models.DailyStat{},
		&models.AppGenerationRequest{},
	)

	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Println("Database initialized successfully")
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}
