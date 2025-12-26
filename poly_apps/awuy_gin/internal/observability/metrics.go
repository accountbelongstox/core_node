package observability

import "github.com/gin-gonic/gin"

// Metrics is a placeholder middleware for metrics collection.
func Metrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}
