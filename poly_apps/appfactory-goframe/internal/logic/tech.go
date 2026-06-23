package logic

import (
	"context"

	"appfactory-goframe/internal/dao"
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/frame/g"
)

// Tech logic for technical team management
type Tech struct {
	userDao *dao.User
	appDao  *dao.App
}

// NewTech creates a new Tech logic
func NewTech() *Tech {
	return &Tech{
		userDao: dao.NewUser(),
		appDao:  dao.NewApp(),
	}
}

// GetAllTech returns all tech members
func (l *Tech) GetAllTech(ctx context.Context) ([]*entity.User, error) {
	techMembers, err := l.userDao.FindByRole(ctx, "tech")
	if err != nil {
		return nil, gerror.New("Failed to fetch tech members")
	}

	// Remove passwords
	for _, tech := range techMembers {
		tech.Password = ""
	}

	return techMembers, nil
}

// GetTechApps returns all apps assigned to a tech member
func (l *Tech) GetTechApps(ctx context.Context, techId string) ([]*entity.AppInstance, error) {
	apps, err := l.appDao.FindByTechId(ctx, techId)
	if err != nil {
		return nil, gerror.New("Failed to fetch apps")
	}
	return apps, nil
}

// AssignTechToApp assigns a tech member to an application
func (l *Tech) AssignTechToApp(ctx context.Context, techId, appId string) (*entity.AppInstance, error) {
	err := l.appDao.Update(ctx, appId, g.Map{
		"assigned_tech_id": techId,
	})
	if err != nil {
		return nil, gerror.New("Failed to assign tech")
	}

	app, err := l.appDao.FindByUid(ctx, appId)
	if err != nil {
		return nil, err
	}

	return app, nil
}

// GetTechWorkload returns workload statistics for a tech member
func (l *Tech) GetTechWorkload(ctx context.Context, techId string) (int64, int64, int64, int64, int64, error) {
	// Count apps by status
	total, _ := l.appDao.CountByTechIdAndStatus(ctx, techId, "")
	live, _ := l.appDao.CountByTechIdAndStatus(ctx, techId, "Live")
	pending, _ := l.appDao.CountByTechIdAndStatus(ctx, techId, "Pending")
	failed, _ := l.appDao.CountByTechIdAndStatus(ctx, techId, "Failed")
	generating, _ := l.appDao.CountByTechIdAndStatus(ctx, techId, "Generating")

	return total, live, pending, failed, generating, nil
}
