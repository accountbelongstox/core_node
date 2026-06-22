package api

import (
	"github.com/gogf/gf/v2/frame/g"
)

// GetDashboardStatsReq get dashboard statistics request
type GetDashboardStatsReq struct {
	g.Meta `path:"/stats/dashboard" method:"get" tags:"Stats" summary:"Get dashboard statistics"`
}

// GetDashboardStatsRes get dashboard statistics response
type GetDashboardStatsRes struct {
	TotalApps      int64   `json:"totalApps" dc:"Total applications"`
	LiveApps       int64   `json:"liveApps" dc:"Live applications"`
	PendingApps    int64   `json:"pendingApps" dc:"Pending applications"`
	FailedApps     int64   `json:"failedApps" dc:"Failed applications"`
	TotalRevenue   float64 `json:"totalRevenue" dc:"Total revenue"`
	MonthlyRevenue float64 `json:"monthlyRevenue" dc:"Monthly revenue"`
	TotalCS        int64   `json:"totalCS" dc:"Total CS members"`
	TotalTech      int64   `json:"totalTech" dc:"Total tech members"`
	TotalVisits    int64   `json:"totalVisits" dc:"Total visits"`
}

// GetRevenueStatsReq get revenue statistics request
type GetRevenueStatsReq struct {
	g.Meta `path:"/stats/revenue" method:"get" tags:"Stats" summary:"Get revenue statistics"`
}

// GetRevenueStatsRes get revenue statistics response
type GetRevenueStatsRes struct {
	CategoryStats []map[string]interface{} `json:"categoryStats" dc:"Revenue by category"`
	TopApps       []map[string]interface{} `json:"topApps" dc:"Top revenue apps"`
}

// GetCSPerformanceReq get CS performance request
type GetCSPerformanceReq struct {
	g.Meta `path:"/stats/cs-performance" method:"get" tags:"Stats" summary:"Get CS performance statistics"`
}

// GetCSPerformanceRes get CS performance response
type GetCSPerformanceRes struct {
	Performance []map[string]interface{} `json:"performance" dc:"CS performance data"`
}

// GetTechPerformanceReq get tech performance request
type GetTechPerformanceReq struct {
	g.Meta `path:"/stats/tech-performance" method:"get" tags:"Stats" summary:"Get tech performance statistics"`
}

// GetTechPerformanceRes get tech performance response
type GetTechPerformanceRes struct {
	Performance []map[string]interface{} `json:"performance" dc:"Tech performance data"`
}
