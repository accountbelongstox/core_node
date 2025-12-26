package controller

import (
	"context"

	"appfactory-goframe/api"
	"appfactory-goframe/internal/logic"
)

// Tech controller
type Tech struct {
	logic *logic.Tech
}

// NewTech creates a new Tech controller
func NewTech() *Tech {
	return &Tech{
		logic: logic.NewTech(),
	}
}

// GetAllTech returns all tech members
func (c *Tech) GetAllTech(ctx context.Context, req *api.GetAllTechReq) (res *api.GetAllTechRes, err error) {
	techMembers, err := c.logic.GetAllTech(ctx)
	if err != nil {
		return nil, err
	}

	return &api.GetAllTechRes{
		TechMembers: techMembers,
	}, nil
}

// GetTechApps returns all apps assigned to a tech member
func (c *Tech) GetTechApps(ctx context.Context, req *api.GetTechAppsReq) (res *api.GetTechAppsRes, err error) {
	apps, err := c.logic.GetTechApps(ctx, req.TechId)
	if err != nil {
		return nil, err
	}

	return &api.GetTechAppsRes{
		Apps: apps,
	}, nil
}

// AssignTechToApp assigns a tech member to an application
func (c *Tech) AssignTechToApp(ctx context.Context, req *api.AssignTechToAppReq) (res *api.AssignTechToAppRes, err error) {
	app, err := c.logic.AssignTechToApp(ctx, req.TechId, req.AppId)
	if err != nil {
		return nil, err
	}

	return &api.AssignTechToAppRes{
		App: app,
	}, nil
}

// GetTechWorkload returns workload statistics for a tech member
func (c *Tech) GetTechWorkload(ctx context.Context, req *api.GetTechWorkloadReq) (res *api.GetTechWorkloadRes, err error) {
	total, live, pending, failed, generating, err := c.logic.GetTechWorkload(ctx, req.TechId)
	if err != nil {
		return nil, err
	}

	return &api.GetTechWorkloadRes{
		TotalApps:      total,
		LiveApps:       live,
		PendingApps:    pending,
		FailedApps:     failed,
		GeneratingApps: generating,
	}, nil
}
