package logic

import (
	"context"
	"encoding/json"

	"appfactory-goframe/internal/dao"
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/util/guid"
)

// App logic for application management
type App struct {
	appDao        *dao.App
	assignmentDao *dao.CSAssignment
	revenueDao    *dao.CSRevenue
}

// NewApp creates a new App logic
func NewApp() *App {
	return &App{
		appDao:        dao.NewApp(),
		assignmentDao: dao.NewCSAssignment(),
		revenueDao:    dao.NewCSRevenue(),
	}
}

// GetAllApps returns all applications with optional filters
func (l *App) GetAllApps(ctx context.Context, status, category, search string) ([]*entity.AppInstance, error) {
	apps, err := l.appDao.FindAll(ctx, status, category, search)
	if err != nil {
		return nil, gerror.New("Failed to fetch applications")
	}
	return apps, nil
}

// GetAppById returns application details by ID
func (l *App) GetAppById(ctx context.Context, id string) (*entity.AppInstance, error) {
	app, err := l.appDao.FindByUid(ctx, id)
	if err != nil || app.Id == 0 {
		return nil, gerror.New("Application not found")
	}
	return app, nil
}

// CreateApp creates a new application
func (l *App) CreateApp(ctx context.Context, name, category, description, targetAudience, assignedTechId string, features []string) (*entity.AppInstance, error) {
	// Convert features to JSON string
	featuresJSON, err := json.Marshal(features)
	if err != nil {
		return nil, gerror.New("Invalid features format")
	}

	// Create app instance
	app := &entity.AppInstance{
		Uid:            guid.S(),
		Name:           name,
		Category:       category,
		Description:    description,
		Features:       string(featuresJSON),
		TargetAudience: targetAudience,
		Status:         "Generating",
		AssignedTechId: assignedTechId,
		Visits:         0,
		Revenue:        0,
		MonthlyRevenue: 0,
	}

	err = l.appDao.Create(ctx, app)
	if err != nil {
		return nil, gerror.New("Failed to create application")
	}

	return app, nil
}

// UpdateAppStatus updates application status
func (l *App) UpdateAppStatus(ctx context.Context, id, status string) (*entity.AppInstance, error) {
	err := l.appDao.Update(ctx, id, g.Map{"status": status})
	if err != nil {
		return nil, gerror.New("Failed to update status")
	}

	app, err := l.appDao.FindByUid(ctx, id)
	if err != nil {
		return nil, gerror.New("Application not found")
	}

	return app, nil
}

// DeleteApp deletes an application
func (l *App) DeleteApp(ctx context.Context, id string) error {
	err := l.appDao.Delete(ctx, id)
	if err != nil {
		return gerror.New("Failed to delete application")
	}
	return nil
}

// GetAppStats returns application statistics
func (l *App) GetAppStats(ctx context.Context, id string) (*entity.AppInstance, []*entity.CSAppAssignment, []*entity.CSAppRevenue, error) {
	app, err := l.appDao.FindByUid(ctx, id)
	if err != nil || app.Id == 0 {
		return nil, nil, nil, gerror.New("Application not found")
	}

	assignments, _ := l.assignmentDao.FindByAppId(ctx, id)
	revenues, _ := l.revenueDao.FindByAppId(ctx, id)

	return app, assignments, revenues, nil
}

// IncrementVisit increments application visit count
func (l *App) IncrementVisit(ctx context.Context, id string) (int64, error) {
	err := l.appDao.IncrementVisits(ctx, id)
	if err != nil {
		return 0, gerror.New("Failed to increment visits")
	}

	app, err := l.appDao.FindByUid(ctx, id)
	if err != nil {
		return 0, err
	}

	return app.Visits, nil
}
