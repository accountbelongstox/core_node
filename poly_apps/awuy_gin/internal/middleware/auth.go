package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type tokenLookup interface {
	GetUsernameByToken(token string) (string, bool)
}

// Auth returns a Gin middleware that checks Bearer tokens via the provided store.
func Auth(store tokenLookup) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenHeader string
		var token string
		var username string
		var ok bool

		tokenHeader = c.GetHeader("Authorization")
		token = strings.TrimSpace(strings.TrimPrefix(tokenHeader, "Bearer"))
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "UNAUTHORIZED",
				"message": "Missing token",
			})
			return
		}
		username, ok = store.GetUsernameByToken(token)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "INVALID_TOKEN",
				"message": "Invalid or expired token",
			})
			return
		}
		c.Set("username", username)
		c.Next()
	}
}
