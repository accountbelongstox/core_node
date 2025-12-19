package dao

import (
	"context"

	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/frame/g"
)

// App DAO for app_instance table operations
type App struct{}

// NewApp creates a new App DAO
func NewApp() *App {
	return &App{}
}

// FindAll finds all apps with optional filters
func (d *App) FindAll(ctx context.Context, status, category, search string) ([]*entity.AppInstance, error) {
	model := g.DB().Model("app_instance")

	if status != "" {
		model = model.Where("status", status)
	}
	if category != "" {
		model = model.Where("category", category)
	}
	if search != "" {
		model = model.WhereLike("name", "%"+search+"%")
	}

	var apps []*entity.AppInstance
	err := model.Scan(&apps)
	return apps, err
}

// FindByUid finds app by UID
func (d *App) FindByUid(ctx context.Context, uid string) (*entity.AppInstance, error) {
	var app entity.AppInstance
	err := g.DB().Model("app_instance").Where("uid", uid).Scan(&app)
	if err != nil {
		return nil, err
	}
	return &app, nil
}

// FindByTechId finds apps by tech ID
func (d *App) FindByTechId(ctx context.Context, techId string) ([]*entity.AppInstance, error) {
	var apps []*entity.AppInstance
	err := g.DB().Model("app_instance").Where("assigned_tech_id", techId).Scan(&apps)
	return apps, err
}

// FindByUids finds apps by multiple UIDs
func (d *App) FindByUids(ctx context.Context, uids []string) ([]*entity.AppInstance, error) {
	var apps []*entity.AppInstance
	if len(uids) == 0 {
		return apps, nil
	}
	err := g.DB().Model("app_instance").WhereIn("uid", uids).Scan(&apps)
	return apps, err
}

// Create creates a new app
func (d *App) Create(ctx context.Context, app *entity.AppInstance) error {
	result, err := g.DB().Model("app_instance").Insert(app)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	app.Id = uint(id)
	return nil
}

// Update updates app
func (d *App) Update(ctx context.Context, uid string, data g.Map) error {
	_, err := g.DB().Model("app_instance").Where("uid", uid).Update(data)
	return err
}

// Delete deletes app
func (d *App) Delete(ctx context.Context, uid string) error {
	_, err := g.DB().Model("app_instance").Where("uid", uid).Delete()
	return err
}

// IncrementVisits increments visit count
func (d *App) IncrementVisits(ctx context.Context, uid string) error {
	_, err := g.DB().Model("app_instance").Where("uid", uid).Increment("visits", 1)
	return err
}

// Count counts apps by condition
func (d *App) Count(ctx context.Context, where ...interface{}) (int64, error) {
	var count int64
	err := g.DB().Model("app_instance").Where(where...).Count(&count)
	return count, err
}

// CountByStatus counts apps by status
func (d *App) CountByStatus(ctx context.Context, status string) (int64, error) {
	var count int64
	err := g.DB().Model("app_instance").Where("status", status).Count(&count)
	return count, err
}

// CountByTechIdAndStatus counts apps by tech ID and status
func (d *App) CountByTechIdAndStatus(ctx context.Context, techId, status string) (int64, error) {
	var count int64
	model := g.DB().Model("app_instance").Where("assigned_tech_id", techId)
	if status != "" {
		model = model.Where("status", status)
	}
	err := model.Count(&count)
	return count, err
}

// SumRevenue sums total revenue
func (d *App) SumRevenue(ctx context.Context) (float64, error) {
	result, err := g.DB().Model("app_instance").Fields("SUM(revenue) as total").One()
	if err != nil || result.IsEmpty() {
		return 0, err
	}
	return result["total"].Float64(), nil
}

// SumMonthlyRevenue sums monthly revenue
func (d *App) SumMonthlyRevenue(ctx context.Context) (float64, error) {
	result, err := g.DB().Model("app_instance").Fields("SUM(monthly_revenue) as total").One()
	if err != nil || result.IsEmpty() {
		return 0, err
	}
	return result["total"].Float64(), nil
}

// SumVisits sums total visits
func (d *App) SumVisits(ctx context.Context) (int64, error) {
	result, err := g.DB().Model("app_instance").Fields("SUM(visits) as total").One()
	if err != nil || result.IsEmpty() {
		return 0, err
	}
	return result["total"].Int64(), nil
}

// GetRevenueByCategory gets revenue grouped by category
func (d *App) GetRevenueByCategory(ctx context.Context) (gdb.Result, error) {
	return g.DB().Model("app_instance").
		Fields("category", "SUM(revenue) as total_revenue", "SUM(monthly_revenue) as monthly_revenue", "COUNT(*) as app_count").
		Group("category").
		All()
}

// GetTopRevenueApps gets top revenue apps
func (d *App) GetTopRevenueApps(ctx context.Context, limit int) (gdb.Result, error) {
	return g.DB().Model("app_instance").
		Fields("uid", "name", "revenue", "monthly_revenue", "category").
		Order("revenue DESC").
		Limit(limit).
		All()
}
