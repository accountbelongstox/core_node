package api

import (
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/frame/g"
)

// GetAllCSReq get all CS members request
type GetAllCSReq struct {
	g.Meta `path:"/cs" method:"get" tags:"CS" summary:"Get all CS members"`
}

// GetAllCSRes get all CS members response
type GetAllCSRes struct {
	CSMembers []*entity.User `json:"csMembers" dc:"CS members list"`
}

// AssignCSToAppReq assign CS to app request
type AssignCSToAppReq struct {
	g.Meta `path:"/cs/assign" method:"post" tags:"CS" summary:"Assign CS to app"`
	CSId   string `json:"csId" v:"required" dc:"CS member ID"`
	AppId  string `json:"appId" v:"required" dc:"APP ID"`
}

// AssignCSToAppRes assign CS to app response
type AssignCSToAppRes struct {
	Assignment *entity.CSAppAssignment `json:"assignment" dc:"Assignment details"`
}

// RemoveCSFromAppReq remove CS from app request
type RemoveCSFromAppReq struct {
	g.Meta `path:"/cs/remove" method:"post" tags:"CS" summary:"Remove CS from app"`
	CSId   string `json:"csId" v:"required" dc:"CS member ID"`
	AppId  string `json:"appId" v:"required" dc:"APP ID"`
}

// RemoveCSFromAppRes remove CS from app response
type RemoveCSFromAppRes struct {
	Message string `json:"message" dc:"Result message"`
}

// GetCSAppsReq get CS apps request
type GetCSAppsReq struct {
	g.Meta `path:"/cs/:csId/apps" method:"get" tags:"CS" summary:"Get apps for CS member"`
	CSId   string `json:"csId" v:"required" dc:"CS member ID"`
}

// GetCSAppsRes get CS apps response
type GetCSAppsRes struct {
	Apps []*entity.AppInstance `json:"apps" dc:"Applications list"`
}

// GetCSRevenueReq get CS revenue request
type GetCSRevenueReq struct {
	g.Meta `path:"/cs/:csId/revenue" method:"get" tags:"CS" summary:"Get revenue for CS member"`
	CSId   string `json:"csId" v:"required" dc:"CS member ID"`
}

// GetCSRevenueRes get CS revenue response
type GetCSRevenueRes struct {
	Revenues        []*entity.CSAppRevenue `json:"revenues" dc:"Revenue list"`
	TotalRevenue    float64                `json:"totalRevenue" dc:"Total revenue"`
	TotalCommission float64                `json:"totalCommission" dc:"Total commission"`
	TotalPromotions int64                  `json:"totalPromotions" dc:"Total promotions"`
}

// UpdateCSRevenueReq update CS revenue request
type UpdateCSRevenueReq struct {
	g.Meta     `path:"/cs/revenue" method:"put" tags:"CS" summary:"Update CS revenue"`
	CSId       string  `json:"csId" v:"required" dc:"CS member ID"`
	AppId      string  `json:"appId" v:"required" dc:"APP ID"`
	Revenue    float64 `json:"revenue" v:"min:0" dc:"Revenue amount"`
	Commission float64 `json:"commission" v:"min:0" dc:"Commission amount"`
	Promotions int64   `json:"promotions" v:"min:0" dc:"Number of promotions"`
}

// UpdateCSRevenueRes update CS revenue response
type UpdateCSRevenueRes struct {
	Revenue *entity.CSAppRevenue `json:"revenue" dc:"Updated revenue"`
}
