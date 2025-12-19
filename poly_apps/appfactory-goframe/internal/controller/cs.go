package controller

import (
	"context"

	"appfactory-goframe/api"
	"appfactory-goframe/internal/logic"
)

// CS controller
type CS struct {
	logic *logic.CS
}

// NewCS creates a new CS controller
func NewCS() *CS {
	return &CS{
		logic: logic.NewCS(),
	}
}

// GetAllCS returns all CS members
func (c *CS) GetAllCS(ctx context.Context, req *api.GetAllCSReq) (res *api.GetAllCSRes, err error) {
	csMembers, err := c.logic.GetAllCS(ctx)
	if err != nil {
		return nil, err
	}

	return &api.GetAllCSRes{
		CSMembers: csMembers,
	}, nil
}

// AssignCSToApp assigns CS member to an application
func (c *CS) AssignCSToApp(ctx context.Context, req *api.AssignCSToAppReq) (res *api.AssignCSToAppRes, err error) {
	assignment, err := c.logic.AssignCSToApp(ctx, req.CSId, req.AppId)
	if err != nil {
		return nil, err
	}

	return &api.AssignCSToAppRes{
		Assignment: assignment,
	}, nil
}

// RemoveCSFromApp removes CS member from an application
func (c *CS) RemoveCSFromApp(ctx context.Context, req *api.RemoveCSFromAppReq) (res *api.RemoveCSFromAppRes, err error) {
	err = c.logic.RemoveCSFromApp(ctx, req.CSId, req.AppId)
	if err != nil {
		return nil, err
	}

	return &api.RemoveCSFromAppRes{
		Message: "CS removed from app successfully",
	}, nil
}

// GetCSApps returns all apps assigned to a CS member
func (c *CS) GetCSApps(ctx context.Context, req *api.GetCSAppsReq) (res *api.GetCSAppsRes, err error) {
	apps, err := c.logic.GetCSApps(ctx, req.CSId)
	if err != nil {
		return nil, err
	}

	return &api.GetCSAppsRes{
		Apps: apps,
	}, nil
}

// GetCSRevenue returns revenue data for a CS member
func (c *CS) GetCSRevenue(ctx context.Context, req *api.GetCSRevenueReq) (res *api.GetCSRevenueRes, err error) {
	revenues, totalRevenue, totalCommission, totalPromotions, err := c.logic.GetCSRevenue(ctx, req.CSId)
	if err != nil {
		return nil, err
	}

	return &api.GetCSRevenueRes{
		Revenues:        revenues,
		TotalRevenue:    totalRevenue,
		TotalCommission: totalCommission,
		TotalPromotions: totalPromotions,
	}, nil
}

// UpdateCSRevenue updates revenue data for CS-App relationship
func (c *CS) UpdateCSRevenue(ctx context.Context, req *api.UpdateCSRevenueReq) (res *api.UpdateCSRevenueRes, err error) {
	revenue, err := c.logic.UpdateCSRevenue(ctx, req.CSId, req.AppId, req.Revenue, req.Commission, req.Promotions)
	if err != nil {
		return nil, err
	}

	return &api.UpdateCSRevenueRes{
		Revenue: revenue,
	}, nil
}
