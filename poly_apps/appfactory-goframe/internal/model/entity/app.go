package entity

import (
	"github.com/gogf/gf/v2/os/gtime"
)

// AppInstance represents an application
type AppInstance struct {
	Id               uint        `json:"id"                orm:"id,primary"         description:"APP ID"`
	Uid              string      `json:"uid"               orm:"uid,unique"         description:"APP unique identifier"`
	Name             string      `json:"name"              orm:"name"               description:"APP name"`
	Status           string      `json:"status"            orm:"status"             description:"Status: Live/Pending/Failed/Idle/Generating"`
	Category         string      `json:"category"          orm:"category"           description:"Category"`
	Visits           int64       `json:"visits"            orm:"visits"             description:"Total visits"`
	Revenue          float64     `json:"revenue"           orm:"revenue"            description:"Total revenue"`
	MonthlyRevenue   float64     `json:"monthlyRevenue"    orm:"monthly_revenue"    description:"Monthly revenue"`
	DailyActiveUsers int64       `json:"dailyActiveUsers"  orm:"daily_active_users" description:"Daily active users"`
	Description      string      `json:"description"       orm:"description"        description:"APP description"`
	AssignedTechId   string      `json:"assignedTechId"    orm:"assigned_tech_id"   description:"Assigned tech member ID"`
	Features         string      `json:"features"          orm:"features,text"      description:"Features (JSON string)"`
	TargetAudience   string      `json:"targetAudience"    orm:"target_audience"    description:"Target audience"`
	LaunchDate       *gtime.Time `json:"launchDate"        orm:"launch_date"        description:"Launch date"`
	Rating           float64     `json:"rating"            orm:"rating"             description:"User rating"`
	CreatedAt        *gtime.Time `json:"createdAt"         orm:"created_at"         description:"Created time"`
	UpdatedAt        *gtime.Time `json:"updatedAt"         orm:"updated_at"         description:"Updated time"`
	DeletedAt        *gtime.Time `json:"-"                 orm:"deleted_at"         description:"Deleted time"`
}

// CustomerService extends user for CS representatives
type CustomerService struct {
	Id             uint        `json:"id"               orm:"id,primary"        description:"CS ID"`
	UserId         string      `json:"userId"           orm:"user_id,unique"    description:"User ID reference"`
	Status         string      `json:"status"           orm:"status"            description:"Status: Online/Offline"`
	TotalEarnings  float64     `json:"totalEarnings"    orm:"total_earnings"    description:"Total earnings"`
	CommissionRate float64     `json:"commissionRate"   orm:"commission_rate"   description:"Commission rate percentage"`
	CreatedAt      *gtime.Time `json:"createdAt"        orm:"created_at"        description:"Created time"`
	UpdatedAt      *gtime.Time `json:"updatedAt"        orm:"updated_at"        description:"Updated time"`
}

// TechMember extends user for technical team
type TechMember struct {
	Id             uint        `json:"id"              orm:"id,primary"      description:"Tech ID"`
	UserId         string      `json:"userId"          orm:"user_id,unique"  description:"User ID reference"`
	Specialization string      `json:"specialization"  orm:"specialization"  description:"Specialization"`
	AppsGenerated  int         `json:"appsGenerated"   orm:"apps_generated"  description:"Number of apps generated"`
	Status         string      `json:"status"          orm:"status"          description:"Status: Available/Busy/Offline"`
	CreatedAt      *gtime.Time `json:"createdAt"       orm:"created_at"      description:"Created time"`
	UpdatedAt      *gtime.Time `json:"updatedAt"       orm:"updated_at"      description:"Updated time"`
}

// CSAppAssignment represents many-to-many relationship
type CSAppAssignment struct {
	Id        uint        `json:"id"        orm:"id,primary"   description:"Assignment ID"`
	CsId      string      `json:"csId"      orm:"cs_id"        description:"CS user ID"`
	AppId     string      `json:"appId"     orm:"app_id"       description:"APP unique ID"`
	CreatedAt *gtime.Time `json:"createdAt" orm:"created_at"   description:"Created time"`
}

// CSAppRevenue tracks revenue per CS per APP
type CSAppRevenue struct {
	Id         uint        `json:"id"         orm:"id,primary"   description:"Revenue ID"`
	Uid        string      `json:"uid"        orm:"uid,unique"   description:"Unique identifier"`
	CsId       string      `json:"csId"       orm:"cs_id"        description:"CS user ID"`
	AppId      string      `json:"appId"      orm:"app_id"       description:"APP unique ID"`
	Revenue    float64     `json:"revenue"    orm:"revenue"      description:"Revenue amount"`
	Commission float64     `json:"commission" orm:"commission"   description:"Commission amount"`
	Promotions int         `json:"promotions" orm:"promotions"   description:"Number of promotions"`
	CreatedAt  *gtime.Time `json:"createdAt"  orm:"created_at"   description:"Created time"`
	UpdatedAt  *gtime.Time `json:"updatedAt"  orm:"updated_at"   description:"Updated time"`
}

// DailyStat represents daily statistics
type DailyStat struct {
	Id          uint        `json:"id"          orm:"id,primary"     description:"Stat ID"`
	Date        string      `json:"date"        orm:"date,unique"    description:"Date (YYYY-MM-DD)"`
	Visits      int64       `json:"visits"      orm:"visits"         description:"Total visits"`
	Revenue     float64     `json:"revenue"     orm:"revenue"        description:"Total revenue"`
	NewApps     int         `json:"newApps"     orm:"new_apps"       description:"New apps created"`
	ActiveUsers int64       `json:"activeUsers" orm:"active_users"   description:"Active users"`
	CreatedAt   *gtime.Time `json:"createdAt"   orm:"created_at"     description:"Created time"`
}

// AppGenerationRequest represents app generation request
type AppGenerationRequest struct {
	Id                      uint        `json:"id"                      orm:"id,primary"                  description:"Request ID"`
	Uid                     string      `json:"uid"                     orm:"uid,unique"                  description:"Unique identifier"`
	Name                    string      `json:"name"                    orm:"name"                        description:"APP name"`
	Category                string      `json:"category"                orm:"category"                    description:"Category"`
	Description             string      `json:"description"             orm:"description"                 description:"Description"`
	Features                string      `json:"features"                orm:"features,text"               description:"Features (JSON)"`
	TargetAudience          string      `json:"targetAudience"          orm:"target_audience"             description:"Target audience"`
	RequestedBy             string      `json:"requestedBy"             orm:"requested_by"                description:"Requester user ID"`
	Status                  string      `json:"status"                  orm:"status"                      description:"Status: pending/in_progress/completed/failed"`
	AssignedTechId          string      `json:"assignedTechId"          orm:"assigned_tech_id"            description:"Assigned tech ID"`
	EstimatedCompletionDate *gtime.Time `json:"estimatedCompletionDate" orm:"estimated_completion_date"   description:"Estimated completion"`
	CompletionDate          *gtime.Time `json:"completionDate"          orm:"completion_date"             description:"Actual completion"`
	CreatedAt               *gtime.Time `json:"createdAt"               orm:"created_at"                  description:"Created time"`
	UpdatedAt               *gtime.Time `json:"updatedAt"               orm:"updated_at"                  description:"Updated time"`
}
