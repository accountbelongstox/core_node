package entity

import (
	"github.com/gogf/gf/v2/os/gtime"
)

// User represents a system user
type User struct {
	Id        uint        `json:"id"         orm:"id,primary"      description:"User ID"`
	Uid       string      `json:"uid"        orm:"uid,unique"      description:"User unique identifier"`
	Name      string      `json:"name"       orm:"name"            description:"User name"`
	Email     string      `json:"email"      orm:"email,unique"    description:"Email address"`
	Password  string      `json:"-"          orm:"password"        description:"Password hash"`
	Role      string      `json:"role"       orm:"role"            description:"User role: admin/cs/tech"`
	Avatar    string      `json:"avatar"     orm:"avatar"          description:"Avatar URL"`
	Phone     string      `json:"phone"      orm:"phone"           description:"Phone number"`
	LastLogin *gtime.Time `json:"lastLogin"  orm:"last_login"      description:"Last login time"`
	CreatedAt *gtime.Time `json:"createdAt"  orm:"created_at"      description:"Created time"`
	UpdatedAt *gtime.Time `json:"updatedAt"  orm:"updated_at"      description:"Updated time"`
	DeletedAt *gtime.Time `json:"-"          orm:"deleted_at"      description:"Deleted time (soft delete)"`
}
