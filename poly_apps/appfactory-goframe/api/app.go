package api

import (
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/frame/g"
)

// GetAllAppsReq get all apps request
type GetAllAppsReq struct {
	g.Meta   `path:"/apps" method:"get" tags:"App" summary:"Get all applications"`
	Status   string `json:"status" dc:"Filter by status"`
	Category string `json:"category" dc:"Filter by category"`
	Search   string `json:"search" dc:"Search by name"`
}

// GetAllAppsRes get all apps response
type GetAllAppsRes struct {
	Apps []*entity.AppInstance `json:"apps" dc:"Application list"`
}

// GetAppByIdReq get app by ID request
type GetAppByIdReq struct {
	g.Meta `path:"/apps/:id" method:"get" tags:"App" summary:"Get app by ID"`
	Id     string `json:"id" v:"required" dc:"APP unique ID"`
}

// GetAppByIdRes get app by ID response
type GetAppByIdRes struct {
	App *entity.AppInstance `json:"app" dc:"Application details"`
}

// CreateAppReq create app request
type CreateAppReq struct {
	g.Meta         `path:"/apps" method:"post" tags:"App" summary:"Create new application"`
	Name           string   `json:"name" v:"required|length:2,100" dc:"APP name"`
	Category       string   `json:"category" v:"required" dc:"APP category"`
	Description    string   `json:"description" v:"length:0,500" dc:"APP description"`
	Features       []string `json:"features" dc:"APP features"`
	TargetAudience string   `json:"targetAudience" v:"length:0,200" dc:"Target audience"`
	AssignedTechId string   `json:"assignedTechId" dc:"Assigned tech member ID"`
}

// CreateAppRes create app response
type CreateAppRes struct {
	App *entity.AppInstance `json:"app" dc:"Created application"`
}

// UpdateAppStatusReq update app status request
type UpdateAppStatusReq struct {
	g.Meta `path:"/apps/:id/status" method:"put" tags:"App" summary:"Update app status"`
	Id     string `json:"id" v:"required" dc:"APP unique ID"`
	Status string `json:"status" v:"required|in:Live,Pending,Failed,Idle,Generating" dc:"New status"`
}

// UpdateAppStatusRes update app status response
type UpdateAppStatusRes struct {
	App *entity.AppInstance `json:"app" dc:"Updated application"`
}

// DeleteAppReq delete app request
type DeleteAppReq struct {
	g.Meta `path:"/apps/:id" method:"delete" tags:"App" summary:"Delete application"`
	Id     string `json:"id" v:"required" dc:"APP unique ID"`
}

// DeleteAppRes delete app response
type DeleteAppRes struct {
	Message string `json:"message" dc:"Result message"`
}

// GetAppStatsReq get app statistics request
type GetAppStatsReq struct {
	g.Meta `path:"/apps/:id/stats" method:"get" tags:"App" summary:"Get app statistics"`
	Id     string `json:"id" v:"required" dc:"APP unique ID"`
}

// GetAppStatsRes get app statistics response
type GetAppStatsRes struct {
	App         *entity.AppInstance        `json:"app" dc:"Application"`
	Assignments []*entity.CSAppAssignment  `json:"assignments" dc:"CS assignments"`
	Revenues    []*entity.CSAppRevenue     `json:"revenues" dc:"Revenue data"`
}

// IncrementVisitReq increment visit request
type IncrementVisitReq struct {
	g.Meta `path:"/apps/:id/visit" method:"post" tags:"App" summary:"Increment app visit count"`
	Id     string `json:"id" v:"required" dc:"APP unique ID"`
}

// IncrementVisitRes increment visit response
type IncrementVisitRes struct {
	Visits int64 `json:"visits" dc:"Total visits"`
}
