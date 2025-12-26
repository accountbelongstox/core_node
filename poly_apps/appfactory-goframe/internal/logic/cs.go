package logic

import (
	"context"

	"appfactory-goframe/internal/dao"
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/util/guid"
)

// CS logic for customer service management
type CS struct {
	userDao       *dao.User
	appDao        *dao.App
	assignmentDao *dao.CSAssignment
	revenueDao    *dao.CSRevenue
}

// NewCS creates a new CS logic
func NewCS() *CS {
	return &CS{
		userDao:       dao.NewUser(),
		appDao:        dao.NewApp(),
		assignmentDao: dao.NewCSAssignment(),
		revenueDao:    dao.NewCSRevenue(),
	}
}

// GetAllCS returns all CS members
func (l *CS) GetAllCS(ctx context.Context) ([]*entity.User, error) {
	csMembers, err := l.userDao.FindByRole(ctx, "cs")
	if err != nil {
		return nil, gerror.New("Failed to fetch CS members")
	}

	// Remove passwords
	for _, cs := range csMembers {
		cs.Password = ""
	}

	return csMembers, nil
}

// AssignCSToApp assigns CS member to an application
func (l *CS) AssignCSToApp(ctx context.Context, csId, appId string) (*entity.CSAppAssignment, error) {
	// Check if assignment already exists
	existing, _ := l.assignmentDao.FindByCSIdAndAppId(ctx, csId, appId)
	if existing != nil && existing.Id > 0 {
		return nil, gerror.New("CS member already assigned to this app")
	}

	// Create assignment
	assignment := &entity.CSAppAssignment{
		CsId:  csId,
		AppId: appId,
	}

	err := l.assignmentDao.Create(ctx, assignment)
	if err != nil {
		return nil, gerror.New("Failed to create assignment")
	}

	return assignment, nil
}

// RemoveCSFromApp removes CS member from an application
func (l *CS) RemoveCSFromApp(ctx context.Context, csId, appId string) error {
	err := l.assignmentDao.Delete(ctx, csId, appId)
	if err != nil {
		return gerror.New("Failed to remove assignment")
	}
	return nil
}

// GetCSApps returns all apps assigned to a CS member
func (l *CS) GetCSApps(ctx context.Context, csId string) ([]*entity.AppInstance, error) {
	// Get assignments
	assignments, err := l.assignmentDao.FindByCSId(ctx, csId)
	if err != nil {
		return nil, gerror.New("Failed to fetch assignments")
	}

	// Get app IDs
	appIds := make([]string, len(assignments))
	for i, assignment := range assignments {
		appIds[i] = assignment.AppId
	}

	// Get apps
	apps, _ := l.appDao.FindByUids(ctx, appIds)

	return apps, nil
}

// GetCSRevenue returns revenue data for a CS member
func (l *CS) GetCSRevenue(ctx context.Context, csId string) ([]*entity.CSAppRevenue, float64, float64, int64, error) {
	revenues, err := l.revenueDao.FindByCSId(ctx, csId)
	if err != nil {
		return nil, 0, 0, 0, gerror.New("Failed to fetch revenue data")
	}

	// Calculate totals
	var totalRevenue, totalCommission float64
	var totalPromotions int64
	for _, rev := range revenues {
		totalRevenue += rev.Revenue
		totalCommission += rev.Commission
		totalPromotions += int64(rev.Promotions)
	}

	return revenues, totalRevenue, totalCommission, totalPromotions, nil
}

// UpdateCSRevenue updates revenue data for CS-App relationship
func (l *CS) UpdateCSRevenue(ctx context.Context, csId, appId string, revenue, commission float64, promotions int64) (*entity.CSAppRevenue, error) {
	// Check if revenue record exists
	existing, _ := l.revenueDao.FindByCSIdAndAppId(ctx, csId, appId)

	if existing != nil && existing.Id > 0 {
		// Update existing
		err := l.revenueDao.Update(ctx, existing.Id, g.Map{
			"revenue":    revenue,
			"commission": commission,
			"promotions": promotions,
		})
		if err != nil {
			return nil, gerror.New("Failed to update revenue")
		}
	} else {
		// Create new
		newRevenue := &entity.CSAppRevenue{
			Uid:        guid.S(),
			CsId:       csId,
			AppId:      appId,
			Revenue:    revenue,
			Commission: commission,
			Promotions: int(promotions),
		}
		err := l.revenueDao.Create(ctx, newRevenue)
		if err != nil {
			return nil, gerror.New("Failed to create revenue")
		}
		existing = newRevenue
	}

	// Fetch updated record
	updated, _ := l.revenueDao.FindByCSIdAndAppId(ctx, csId, appId)

	return updated, nil
}
