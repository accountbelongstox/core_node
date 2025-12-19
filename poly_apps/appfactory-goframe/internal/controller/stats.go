package controller

import (
	"context"

	"appfactory-goframe/api"
	"appfactory-goframe/internal/logic"
	"github.com/gogf/gf/v2/errors/gerror"
)

// Stats controller
type Stats struct {
	logic *logic.Stats
}

// NewStats creates a new Stats controller
func NewStats() *Stats {
	return &Stats{
		logic: logic.NewStats(),
	}
}

// GetDashboardStats returns overall dashboard statistics
func (c *Stats) GetDashboardStats(ctx context.Context, req *api.GetDashboardStatsReq) (res *api.GetDashboardStatsRes, err error) {
	stats, err := c.logic.GetDashboardStats(ctx)
	if err != nil {
		return nil, err
	}

	return &api.GetDashboardStatsRes{
		TotalApps:      stats["totalApps"].(int64),
		LiveApps:       stats["liveApps"].(int64),
		PendingApps:    stats["pendingApps"].(int64),
		FailedApps:     stats["failedApps"].(int64),
		TotalRevenue:   stats["totalRevenue"].(float64),
		MonthlyRevenue: stats["monthlyRevenue"].(float64),
		TotalCS:        stats["totalCS"].(int64),
		TotalTech:      stats["totalTech"].(int64),
		TotalVisits:    stats["totalVisits"].(int64),
	}, nil
}

// GetRevenueStats returns revenue statistics
func (c *Stats) GetRevenueStats(ctx context.Context, req *api.GetRevenueStatsReq) (res *api.GetRevenueStatsRes, err error) {
	categoryStats, topApps, err := c.logic.GetRevenueStats(ctx)
	if err != nil {
		return nil, gerror.New("Failed to fetch revenue stats")
	}

	return &api.GetRevenueStatsRes{
		CategoryStats: categoryStats,
		TopApps:       topApps,
	}, nil
}

// GetCSPerformance returns CS performance statistics
func (c *Stats) GetCSPerformance(ctx context.Context, req *api.GetCSPerformanceReq) (res *api.GetCSPerformanceRes, err error) {
	performance, err := c.logic.GetCSPerformance(ctx)
	if err != nil {
		return nil, gerror.New("Failed to fetch CS performance")
	}

	return &api.GetCSPerformanceRes{
		Performance: performance,
	}, nil
}

// GetTechPerformance returns tech performance statistics
func (c *Stats) GetTechPerformance(ctx context.Context, req *api.GetTechPerformanceReq) (res *api.GetTechPerformanceRes, err error) {
	performance, err := c.logic.GetTechPerformance(ctx)
	if err != nil {
		return nil, gerror.New("Failed to fetch tech performance")
	}

	return &api.GetTechPerformanceRes{
		Performance: performance,
	}, nil
}
