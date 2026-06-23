package logic

import (
	"context"

	"appfactory-goframe/internal/dao"
	"github.com/gogf/gf/v2/errors/gerror"
)

// Stats logic for statistics
type Stats struct {
	userDao    *dao.User
	appDao     *dao.App
	revenueDao *dao.CSRevenue
}

// NewStats creates a new Stats logic
func NewStats() *Stats {
	return &Stats{
		userDao:    dao.NewUser(),
		appDao:     dao.NewApp(),
		revenueDao: dao.NewCSRevenue(),
	}
}

// GetDashboardStats returns overall dashboard statistics
func (l *Stats) GetDashboardStats(ctx context.Context) (map[string]interface{}, error) {
	// Count apps by status
	totalApps, _ := l.appDao.Count(ctx)
	liveApps, _ := l.appDao.CountByStatus(ctx, "Live")
	pendingApps, _ := l.appDao.CountByStatus(ctx, "Pending")
	failedApps, _ := l.appDao.CountByStatus(ctx, "Failed")

	// Calculate revenues
	totalRevenue, _ := l.appDao.SumRevenue(ctx)
	monthlyRevenue, _ := l.appDao.SumMonthlyRevenue(ctx)

	// Count users
	totalCS, _ := l.userDao.Count(ctx, "role", "cs")
	totalTech, _ := l.userDao.Count(ctx, "role", "tech")

	// Calculate total visits
	totalVisits, _ := l.appDao.SumVisits(ctx)

	return map[string]interface{}{
		"totalApps":      totalApps,
		"liveApps":       liveApps,
		"pendingApps":    pendingApps,
		"failedApps":     failedApps,
		"totalRevenue":   totalRevenue,
		"monthlyRevenue": monthlyRevenue,
		"totalCS":        totalCS,
		"totalTech":      totalTech,
		"totalVisits":    totalVisits,
	}, nil
}

// GetRevenueStats returns revenue statistics
func (l *Stats) GetRevenueStats(ctx context.Context) ([]map[string]interface{}, []map[string]interface{}, error) {
	// Get revenue by category
	rows, err := l.appDao.GetRevenueByCategory(ctx)
	if err != nil {
		return nil, nil, gerror.New("Failed to fetch revenue stats")
	}

	var categoryStats []map[string]interface{}
	for _, row := range rows {
		categoryStats = append(categoryStats, map[string]interface{}{
			"category":       row["category"].String(),
			"totalRevenue":   row["total_revenue"].Float64(),
			"monthlyRevenue": row["monthly_revenue"].Float64(),
			"appCount":       row["app_count"].Int64(),
		})
	}

	// Get top revenue apps
	var topApps []map[string]interface{}
	topRows, err := l.appDao.GetTopRevenueApps(ctx, 10)
	if err == nil {
		for _, row := range topRows {
			topApps = append(topApps, map[string]interface{}{
				"id":             row["uid"].String(),
				"name":           row["name"].String(),
				"revenue":        row["revenue"].Float64(),
				"monthlyRevenue": row["monthly_revenue"].Float64(),
				"category":       row["category"].String(),
			})
		}
	}

	return categoryStats, topApps, nil
}

// GetCSPerformance returns CS performance statistics
func (l *Stats) GetCSPerformance(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := l.revenueDao.GetCSPerformance(ctx)
	if err != nil {
		return nil, gerror.New("Failed to fetch CS performance")
	}

	var performance []map[string]interface{}
	for _, row := range rows {
		performance = append(performance, map[string]interface{}{
			"csId":            row["uid"].String(),
			"name":            row["name"].String(),
			"email":           row["email"].String(),
			"appCount":        row["app_count"].Int64(),
			"totalRevenue":    row["total_revenue"].Float64(),
			"totalCommission": row["total_commission"].Float64(),
			"totalPromotions": row["total_promotions"].Int64(),
		})
	}

	return performance, nil
}

// GetTechPerformance returns tech performance statistics
func (l *Stats) GetTechPerformance(ctx context.Context) ([]map[string]interface{}, error) {
	// Get all tech members
	techMembers, err := l.userDao.FindByRole(ctx, "tech")
	if err != nil {
		return nil, gerror.New("Failed to fetch tech members")
	}

	var performance []map[string]interface{}
	for _, tech := range techMembers {
		// Get apps for this tech
		apps, _ := l.appDao.FindByTechId(ctx, tech.Uid)

		var totalApps, liveApps, failedApps int64
		var totalRevenue float64

		totalApps = int64(len(apps))
		for _, app := range apps {
			if app.Status == "Live" {
				liveApps++
			}
			if app.Status == "Failed" {
				failedApps++
			}
			totalRevenue += app.Revenue
		}

		performance = append(performance, map[string]interface{}{
			"techId":       tech.Uid,
			"name":         tech.Name,
			"email":        tech.Email,
			"totalApps":    totalApps,
			"liveApps":     liveApps,
			"failedApps":   failedApps,
			"totalRevenue": totalRevenue,
		})
	}

	return performance, nil
}
