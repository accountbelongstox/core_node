package controller

import (
	"context"

	"appfactory-goframe/api"
	"appfactory-goframe/internal/logic"
)

// Auth controller
type Auth struct {
	logic *logic.Auth
}

// NewAuth creates a new Auth controller
func NewAuth() *Auth {
	return &Auth{
		logic: logic.NewAuth(),
	}
}

// Login handles user login
func (c *Auth) Login(ctx context.Context, req *api.LoginReq) (res *api.LoginRes, err error) {
	user, token, err := c.logic.Login(ctx, req.Email, req.Password)
	if err != nil {
		return nil, err
	}

	return &api.LoginRes{
		Token: token,
		User:  user,
	}, nil
}

// Register handles user registration
func (c *Auth) Register(ctx context.Context, req *api.RegisterReq) (res *api.RegisterRes, err error) {
	user, err := c.logic.Register(ctx, req.Name, req.Email, req.Password, req.Role, req.Phone)
	if err != nil {
		return nil, err
	}

	return &api.RegisterRes{
		User: user,
	}, nil
}

// GetCurrentUser returns current user info
func (c *Auth) GetCurrentUser(ctx context.Context, req *api.GetCurrentUserReq) (res *api.GetCurrentUserRes, err error) {
	userId := ctx.Value("user_id")
	if userId == nil {
		return nil, err
	}

	user, err := c.logic.GetCurrentUser(ctx, userId.(string))
	if err != nil {
		return nil, err
	}

	return &api.GetCurrentUserRes{
		User: user,
	}, nil
}
