package api

import (
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/frame/g"
)

// LoginReq login request
type LoginReq struct {
	g.Meta `path:"/auth/login" method:"post" tags:"Auth" summary:"User login"`
	Email  string `json:"email" v:"required|email" dc:"Email address"`
	Password string `json:"password" v:"required|min-length:6" dc:"Password"`
}

// LoginRes login response
type LoginRes struct {
	Token string       `json:"token" dc:"JWT token"`
	User  *entity.User `json:"user" dc:"User information"`
}

// RegisterReq register request
type RegisterReq struct {
	g.Meta   `path:"/auth/register" method:"post" tags:"Auth" summary:"User registration"`
	Name     string `json:"name" v:"required|length:2,30" dc:"User name"`
	Email    string `json:"email" v:"required|email" dc:"Email address"`
	Password string `json:"password" v:"required|min-length:6" dc:"Password"`
	Role     string `json:"role" v:"required|in:admin,cs,tech" dc:"User role"`
	Phone    string `json:"phone" v:"phone-loose" dc:"Phone number"`
}

// RegisterRes register response
type RegisterRes struct {
	User *entity.User `json:"user" dc:"Created user"`
}

// GetCurrentUserReq get current user request
type GetCurrentUserReq struct {
	g.Meta `path:"/auth/me" method:"get" tags:"Auth" summary:"Get current user info"`
}

// GetCurrentUserRes get current user response
type GetCurrentUserRes struct {
	User *entity.User `json:"user" dc:"User information"`
}
