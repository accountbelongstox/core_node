package controller

import (
	"context"

	"appfactory-goframe/api"
	"appfactory-goframe/internal/logic"
)

// App controller
type App struct {
	logic *logic.App
}

// NewApp creates a new App controller
func NewApp() *App {
	return &App{
		logic: logic.NewApp(),
	}
}

// GetAllApps returns all applications with optional filters
func (c *App) GetAllApps(ctx context.Context, req *api.GetAllAppsReq) (res *api.GetAllAppsRes, err error) {
	apps, err := c.logic.GetAllApps(ctx, req.Status, req.Category, req.Search)
	if err != nil {
		return nil, err
	}

	return &api.GetAllAppsRes{
		Apps: apps,
	}, nil
}

// GetAppById returns application details by ID
func (c *App) GetAppById(ctx context.Context, req *api.GetAppByIdReq) (res *api.GetAppByIdRes, err error) {
	app, err := c.logic.GetAppById(ctx, req.Id)
	if err != nil {
		return nil, err
	}

	return &api.GetAppByIdRes{
		App: app,
	}, nil
}

// CreateApp creates a new application
func (c *App) CreateApp(ctx context.Context, req *api.CreateAppReq) (res *api.CreateAppRes, err error) {
	app, err := c.logic.CreateApp(ctx, req.Name, req.Category, req.Description, req.TargetAudience, req.AssignedTechId, req.Features)
	if err != nil {
		return nil, err
	}

	return &api.CreateAppRes{
		App: app,
	}, nil
}

// UpdateAppStatus updates application status
func (c *App) UpdateAppStatus(ctx context.Context, req *api.UpdateAppStatusReq) (res *api.UpdateAppStatusRes, err error) {
	app, err := c.logic.UpdateAppStatus(ctx, req.Id, req.Status)
	if err != nil {
		return nil, err
	}

	return &api.UpdateAppStatusRes{
		App: app,
	}, nil
}

// DeleteApp deletes an application
func (c *App) DeleteApp(ctx context.Context, req *api.DeleteAppReq) (res *api.DeleteAppRes, err error) {
	err = c.logic.DeleteApp(ctx, req.Id)
	if err != nil {
		return nil, err
	}

	return &api.DeleteAppRes{
		Message: "Application deleted successfully",
	}, nil
}

// GetAppStats returns application statistics
func (c *App) GetAppStats(ctx context.Context, req *api.GetAppStatsReq) (res *api.GetAppStatsRes, err error) {
	app, assignments, revenues, err := c.logic.GetAppStats(ctx, req.Id)
	if err != nil {
		return nil, err
	}

	return &api.GetAppStatsRes{
		App:         app,
		Assignments: assignments,
		Revenues:    revenues,
	}, nil
}

// IncrementVisit increments application visit count
func (c *App) IncrementVisit(ctx context.Context, req *api.IncrementVisitReq) (res *api.IncrementVisitRes, err error) {
	visits, err := c.logic.IncrementVisit(ctx, req.Id)
	if err != nil {
		return nil, err
	}

	return &api.IncrementVisitRes{
		Visits: visits,
	}, nil
}
