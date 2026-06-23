package api

import (
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/frame/g"
)

// GetAllTechReq get all tech members request
type GetAllTechReq struct {
	g.Meta `path:"/tech" method:"get" tags:"Tech" summary:"Get all tech members"`
}

// GetAllTechRes get all tech members response
type GetAllTechRes struct {
	TechMembers []*entity.User `json:"techMembers" dc:"Tech members list"`
}

// GetTechAppsReq get tech apps request
type GetTechAppsReq struct {
	g.Meta `path:"/tech/:techId/apps" method:"get" tags:"Tech" summary:"Get apps for tech member"`
	TechId string `json:"techId" v:"required" dc:"Tech member ID"`
}

// GetTechAppsRes get tech apps response
type GetTechAppsRes struct {
	Apps []*entity.AppInstance `json:"apps" dc:"Applications list"`
}

// AssignTechToAppReq assign tech to app request
type AssignTechToAppReq struct {
	g.Meta `path:"/tech/assign" method:"post" tags:"Tech" summary:"Assign tech to app"`
	TechId string `json:"techId" v:"required" dc:"Tech member ID"`
	AppId  string `json:"appId" v:"required" dc:"APP ID"`
}

// AssignTechToAppRes assign tech to app response
type AssignTechToAppRes struct {
	App *entity.AppInstance `json:"app" dc:"Updated application"`
}

// GetTechWorkloadReq get tech workload request
type GetTechWorkloadReq struct {
	g.Meta `path:"/tech/:techId/workload" method:"get" tags:"Tech" summary:"Get workload for tech member"`
	TechId string `json:"techId" v:"required" dc:"Tech member ID"`
}

// GetTechWorkloadRes get tech workload response
type GetTechWorkloadRes struct {
	TotalApps      int64 `json:"totalApps" dc:"Total applications"`
	LiveApps       int64 `json:"liveApps" dc:"Live applications"`
	PendingApps    int64 `json:"pendingApps" dc:"Pending applications"`
	FailedApps     int64 `json:"failedApps" dc:"Failed applications"`
	GeneratingApps int64 `json:"generatingApps" dc:"Generating applications"`
}
