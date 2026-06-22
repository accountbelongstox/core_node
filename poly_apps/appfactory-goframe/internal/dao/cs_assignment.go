package dao

import (
	"context"

	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/frame/g"
)

// CSAssignment DAO for cs_app_assignment table operations
type CSAssignment struct{}

// NewCSAssignment creates a new CSAssignment DAO
func NewCSAssignment() *CSAssignment {
	return &CSAssignment{}
}

// FindByCSId finds assignments by CS ID
func (d *CSAssignment) FindByCSId(ctx context.Context, csId string) ([]*entity.CSAppAssignment, error) {
	var assignments []*entity.CSAppAssignment
	err := g.DB().Model("cs_app_assignment").Where("cs_id", csId).Scan(&assignments)
	return assignments, err
}

// FindByAppId finds assignments by App ID
func (d *CSAssignment) FindByAppId(ctx context.Context, appId string) ([]*entity.CSAppAssignment, error) {
	var assignments []*entity.CSAppAssignment
	err := g.DB().Model("cs_app_assignment").Where("app_id", appId).Scan(&assignments)
	return assignments, err
}

// FindByCSIdAndAppId finds assignment by CS ID and App ID
func (d *CSAssignment) FindByCSIdAndAppId(ctx context.Context, csId, appId string) (*entity.CSAppAssignment, error) {
	var assignment entity.CSAppAssignment
	err := g.DB().Model("cs_app_assignment").
		Where("cs_id", csId).
		Where("app_id", appId).
		Scan(&assignment)
	if err != nil {
		return nil, err
	}
	return &assignment, nil
}

// Create creates a new assignment
func (d *CSAssignment) Create(ctx context.Context, assignment *entity.CSAppAssignment) error {
	result, err := g.DB().Model("cs_app_assignment").Insert(assignment)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	assignment.Id = uint(id)
	return nil
}

// Delete deletes assignment
func (d *CSAssignment) Delete(ctx context.Context, csId, appId string) error {
	_, err := g.DB().Model("cs_app_assignment").
		Where("cs_id", csId).
		Where("app_id", appId).
		Delete()
	return err
}

// DeleteByAppId deletes all assignments for an app
func (d *CSAssignment) DeleteByAppId(ctx context.Context, appId string) error {
	_, err := g.DB().Model("cs_app_assignment").Where("app_id", appId).Delete()
	return err
}
