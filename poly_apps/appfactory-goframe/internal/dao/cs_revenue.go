package dao

import (
	"context"

	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/frame/g"
)

// CSRevenue DAO for cs_app_revenue table operations
type CSRevenue struct{}

// NewCSRevenue creates a new CSRevenue DAO
func NewCSRevenue() *CSRevenue {
	return &CSRevenue{}
}

// FindByCSId finds revenues by CS ID
func (d *CSRevenue) FindByCSId(ctx context.Context, csId string) ([]*entity.CSAppRevenue, error) {
	var revenues []*entity.CSAppRevenue
	err := g.DB().Model("cs_app_revenue").Where("cs_id", csId).Scan(&revenues)
	return revenues, err
}

// FindByAppId finds revenues by App ID
func (d *CSRevenue) FindByAppId(ctx context.Context, appId string) ([]*entity.CSAppRevenue, error) {
	var revenues []*entity.CSAppRevenue
	err := g.DB().Model("cs_app_revenue").Where("app_id", appId).Scan(&revenues)
	return revenues, err
}

// FindByCSIdAndAppId finds revenue by CS ID and App ID
func (d *CSRevenue) FindByCSIdAndAppId(ctx context.Context, csId, appId string) (*entity.CSAppRevenue, error) {
	var revenue entity.CSAppRevenue
	err := g.DB().Model("cs_app_revenue").
		Where("cs_id", csId).
		Where("app_id", appId).
		Scan(&revenue)
	if err != nil {
		return nil, err
	}
	return &revenue, nil
}

// Create creates a new revenue record
func (d *CSRevenue) Create(ctx context.Context, revenue *entity.CSAppRevenue) error {
	result, err := g.DB().Model("cs_app_revenue").Insert(revenue)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	revenue.Id = uint(id)
	return nil
}

// Update updates revenue record
func (d *CSRevenue) Update(ctx context.Context, id uint, data g.Map) error {
	_, err := g.DB().Model("cs_app_revenue").Where("id", id).Update(data)
	return err
}

// Delete deletes revenue record
func (d *CSRevenue) Delete(ctx context.Context, csId, appId string) error {
	_, err := g.DB().Model("cs_app_revenue").
		Where("cs_id", csId).
		Where("app_id", appId).
		Delete()
	return err
}

// GetCSPerformance gets CS performance statistics
func (d *CSRevenue) GetCSPerformance(ctx context.Context) (gdb.Result, error) {
	return g.DB().Model("user u").
		LeftJoin("cs_app_revenue r", "u.uid = r.cs_id").
		Fields("u.uid", "u.name", "u.email",
			"COUNT(DISTINCT r.app_id) as app_count",
			"SUM(r.revenue) as total_revenue",
			"SUM(r.commission) as total_commission",
			"SUM(r.promotions) as total_promotions").
		Where("u.role", "cs").
		Group("u.uid, u.name, u.email").
		All()
}
