package main

import (
	_ "appfactory-goframe/internal/packed"

	"appfactory-goframe/internal/controller"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/net/ghttp"
	"github.com/gogf/gf/v2/os/gctx"
)

func main() {
	ctx := gctx.New()
	s := g.Server()

	// CORS middleware
	s.Use(MiddlewareCORS)

	// Group routes
	s.Group("/api/v1", func(group *ghttp.RouterGroup) {
		// Authentication routes (public)
		authCtrl := new(controller.Auth)
		group.Bind(
			authCtrl,
		)

		// Protected routes
		group.Middleware(MiddlewareAuth)
		group.Group("", func(protectedGroup *ghttp.RouterGroup) {
			// App routes
			appCtrl := new(controller.App)
			protectedGroup.Bind(
				appCtrl,
			)

			// CS routes
			csCtrl := new(controller.CS)
			protectedGroup.Bind(
				csCtrl,
			)

			// Tech routes
			techCtrl := new(controller.Tech)
			protectedGroup.Bind(
				techCtrl,
			)

			// Stats routes
			statsCtrl := new(controller.Stats)
			protectedGroup.Bind(
				statsCtrl,
			)
		})
	})

	// Health check
	s.BindHandler("/health", func(r *ghttp.Request) {
		r.Response.WriteJson(g.Map{
			"status": "ok",
		})
	})

	s.Run()
}

// MiddlewareCORS handles CORS
func MiddlewareCORS(r *ghttp.Request) {
	r.Response.CORSDefault()
	r.Middleware.Next()
}

// MiddlewareAuth handles JWT authentication
func MiddlewareAuth(r *ghttp.Request) {
	// Get token from Authorization header
	token := r.Header.Get("Authorization")
	if token == "" {
		r.Response.WriteJson(g.Map{
			"code":    401,
			"message": "Authorization header required",
		})
		return
	}

	// Extract token (remove "Bearer " prefix)
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	} else {
		r.Response.WriteJson(g.Map{
			"code":    401,
			"message": "Invalid authorization format",
		})
		return
	}

	// Validate token
	claims, err := validateToken(token)
	if err != nil {
		r.Response.WriteJson(g.Map{
			"code":    401,
			"message": "Invalid token",
		})
		return
	}

	// Set user info in context
	r.SetCtxVar("user_id", claims["user_id"])
	r.SetCtxVar("email", claims["email"])
	r.SetCtxVar("role", claims["role"])

	r.Middleware.Next()
}

// validateToken validates JWT token
func validateToken(tokenString string) (map[string]interface{}, error) {
	// This is a simplified version
	// In production, use proper JWT validation
	return map[string]interface{}{
		"user_id": "sample-uid",
		"email":   "user@example.com",
		"role":    "admin",
	}, nil
}
