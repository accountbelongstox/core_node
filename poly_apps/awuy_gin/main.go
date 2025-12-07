package main

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"

	"awuy_gin/internal/config"
	"awuy_gin/internal/domain"
	"awuy_gin/internal/logger"
	mw "awuy_gin/internal/middleware"
	"awuy_gin/internal/observability"
	"awuy_gin/internal/repository"
	"awuy_gin/internal/service"
)

type apiResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

var store repository.DataStore
var services *service.Services
var tokenStore sync.Map
var appConfig config.Config

func main() {
	appConfig = config.Load()
	log := logger.New()
	store = initStore()
	services = service.NewServices(store)

	router := gin.Default()
	router.Use(gin.Logger(), gin.Recovery(), observability.Metrics())

	router.GET("/health", func(c *gin.Context) {
		start := time.Now()
		duration := time.Since(start)
		c.JSON(http.StatusOK, apiResponse{
			Success: true,
			Message: "healthy",
			Data: map[string]interface{}{
				"service":   "AwyV0 Gin API",
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"version":   "0.1.0",
				"duration":  duration.Milliseconds(),
			},
		})
	})

	registerAuthRoutes(router)
	registerUserRoutes(router)
	registerFriendRoutes(router)
	registerDeviceRoutes(router)
	registerChatRoutes(router)
	registerSearchRoutes(router)
	registerDashboardRoutes(router)

	if err := router.Run(":" + appConfig.HTTPPort); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func initStore() repository.DataStore {
	pg, err := newPgStore(appConfig.PGDSN)
	if err == nil {
		return pg
	}
	return newMemoryStore()
}

func registerAuthRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/auth")
	group.POST("/register", handleRegister)
	group.POST("/login", handleLogin)
	group.POST("/logout", mw.Auth(store), handleLogout)
	group.POST("/verify-email", handleVerifyEmail)
	group.POST("/forgot-password", handleForgotPassword)
	group.POST("/reset-password", handleResetPassword)
	group.POST("/send-sms", handleSendSms)
	group.POST("/phone-login", handlePhoneLogin)
}

func registerUserRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/user")
	group.Use(mw.Auth(store))
	group.GET("/profile", handleProfile)
	group.PUT("/profile", handleUpdateProfile)
	group.POST("/change-password", handleChangePassword)
	group.POST("/bind-phone", handleBindPhone)
	group.POST("/bind-email", handleBindEmail)
	group.POST("/avatar", handleUploadAvatar)
}

func registerFriendRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/friend")
	group.Use(mw.Auth(store))
	group.GET("/list", handleFriendList)
	group.POST("/add", handleFriendAdd)
	group.DELETE("/remove", handleFriendRemove)
	group.GET("/info", handleFriendInfo)
	group.GET("/health", func(c *gin.Context) {
		success(c, "Friend service healthy", map[string]interface{}{
			"uptimeSeconds": 1200,
			"connections":   3,
		})
	})
	group.GET("/search", handleFriendSearch)
}

func registerDeviceRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/device")
	group.Use(mw.Auth(store))
	group.POST("/register", handleDeviceRegister)
	group.DELETE("/unregister", handleDeviceUnregister)
	group.GET("/list", handleDeviceList)
	group.PUT("/update", handleDeviceUpdate)
}

func registerChatRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/chat")
	group.Use(mw.Auth(store))
	group.GET("/conversations", handleChatConversations)
	group.GET("/messages/:conversationId", handleChatMessages)
	group.POST("/send", handleChatSend)
	group.GET("/history/:friendId", handleChatHistory)
	group.DELETE("/message/:messageId", handleChatDelete)
	group.PUT("/message/:messageId/read", handleChatMarkRead)
}

func registerSearchRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/search")
	group.Use(mw.Auth(store))
	group.GET("/", handleGlobalSearch)
	group.GET("/users", handleSearchUsers)
}

func registerDashboardRoutes(router *gin.Engine) {
	group := router.Group("/awy-v0/dashboard")
	group.Use(mw.Auth(store))
	group.GET("/stats", handleDashboardStats)
	group.GET("/activity", handleDashboardActivity)
	group.GET("/insights", handleDashboardInsights)
}

// Auth handlers
func handleRegister(c *gin.Context) {
	var payload struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Username == "" || payload.Email == "" || payload.Password == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "username, email and password are required", nil)
		return
	}
	user, token, refresh, err := services.Auth.Register(c.Request.Context(), payload.Username, payload.Email, payload.Password, payload.Name)
	if err != nil {
		failure(c, http.StatusBadRequest, "REGISTRATION_FAILED", err.Error(), nil)
		return
	}
	success(c, "User registered successfully", map[string]interface{}{
		"user": map[string]interface{}{
			"id":          user.ID,
			"username":    user.Username,
			"email":       user.Email,
			"phone":       user.Phone,
			"avatar":      user.Avatar,
			"lastLoginAt": user.LastLoginAt.UTC().Format(time.RFC3339),
		},
		"login_token":           token,
		"user_token":            token,
		"user_token_expires_at": time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339),
		"token_type":            "Bearer",
		"refresh_token":         refresh,
	})
}

func handleLogin(c *gin.Context) {
	var payload struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Username == "" || payload.Password == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "username and password are required", nil)
		return
	}
	user, token, refresh, err := services.Auth.Login(c.Request.Context(), payload.Username, payload.Password)
	if err != nil {
		failure(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", err.Error(), nil)
		return
	}
	success(c, "Login successful", map[string]interface{}{
		"user": map[string]interface{}{
			"id":          user.ID,
			"username":    user.Username,
			"email":       user.Email,
			"phone":       user.Phone,
			"avatar":      user.Avatar,
			"lastLoginAt": user.LastLoginAt.UTC().Format(time.RFC3339),
		},
		"token": map[string]interface{}{
			"accessToken":  token,
			"refreshToken": refresh,
			"expiresIn":    86400,
			"tokenType":    "Bearer",
		},
	})
}

func handleLogout(c *gin.Context) {
	tokenHeader := c.GetHeader("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(tokenHeader, "Bearer"))
	services.Auth.Logout(token)
	success(c, "Logout successful", true)
}

func handleVerifyEmail(c *gin.Context) {
	var payload struct {
		Email            string `json:"email"`
		VerificationCode string `json:"verification_code"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Email == "" || payload.VerificationCode == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "email and verification_code are required", nil)
		return
	}
	if err := services.Auth.VerifyEmail(c.Request.Context(), payload.Email, payload.VerificationCode); err != nil {
		failure(c, http.StatusBadRequest, "INVALID_VERIFICATION_CODE", err.Error(), nil)
		return
	}
	success(c, "Email verified successfully", true)
}

func handleForgotPassword(c *gin.Context) {
	var payload struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Email == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "email is required", nil)
		return
	}
	rt, err := services.Auth.ForgotPassword(c.Request.Context(), payload.Email)
	if err != nil {
		failure(c, http.StatusNotFound, "USER_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Password reset link sent", map[string]interface{}{
		"reset_token": rt.Token,
		"expires_at":  rt.ExpiresAt.UTC().Format(time.RFC3339),
	})
}

func handleResetPassword(c *gin.Context) {
	var payload struct {
		Email    string `json:"email"`
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Email == "" || payload.Token == "" || payload.Password == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "email, token and password are required", nil)
		return
	}
	if err := services.Auth.ResetPassword(c.Request.Context(), payload.Email, payload.Token, payload.Password); err != nil {
		failure(c, http.StatusBadRequest, "INVALID_OR_EXPIRED_TOKEN", err.Error(), nil)
		return
	}
	success(c, "Password reset successfully", true)
}

func handleSendSms(c *gin.Context) {
	var payload struct {
		Phone       string `json:"phone"`
		CountryCode string `json:"country_code"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Phone == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "phone is required", nil)
		return
	}
	verificationID, timeoutSeconds, code, err := services.Auth.SendSms(c.Request.Context(), payload.Phone, payload.CountryCode)
	if err != nil {
		failure(c, http.StatusBadRequest, "SEND_CODE_FAILED", err.Error(), nil)
		return
	}
	success(c, "SMS verification code sent", map[string]interface{}{
		"verification_id": verificationID,
		"timeout_seconds": timeoutSeconds,
		"debug_code":      code,
	})
}

func handlePhoneLogin(c *gin.Context) {
	var payload struct {
		Phone            string `json:"phone"`
		VerificationCode string `json:"verification_code"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Phone == "" || payload.VerificationCode == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "phone and verification_code are required", nil)
		return
	}
	user, token, refresh, err := services.Auth.PhoneLogin(c.Request.Context(), payload.Phone, payload.VerificationCode)
	if err != nil {
		failure(c, http.StatusBadRequest, "INVALID_CODE", err.Error(), nil)
		return
	}
	success(c, "Phone login successful", map[string]interface{}{
		"user": map[string]interface{}{
			"id":          user.ID,
			"username":    user.Username,
			"email":       user.Email,
			"phone":       user.Phone,
			"avatar":      user.Avatar,
			"lastLoginAt": user.LastLoginAt.UTC().Format(time.RFC3339),
		},
		"token": map[string]interface{}{
			"accessToken":  token,
			"refreshToken": refresh,
			"expiresIn":    86400,
			"tokenType":    "Bearer",
		},
	})
}

// User handlers
func handleProfile(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	user, err := services.User.Profile(c.Request.Context(), username)
	if err != nil {
		failure(c, http.StatusNotFound, "USER_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Profile fetched", map[string]interface{}{
		"id":          user.ID,
		"username":    user.Username,
		"email":       user.Email,
		"phone":       user.Phone,
		"avatar":      user.Avatar,
		"name":        user.Name,
		"lastLoginAt": user.LastLoginAt.UTC().Format(time.RFC3339),
	})
}

func handleUpdateProfile(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		Name   string `json:"name"`
		Avatar string `json:"avatar"`
		Phone  string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "invalid payload", nil)
		return
	}
	u, err := services.User.UpdateProfile(c.Request.Context(), username, payload.Name, payload.Avatar, payload.Phone)
	if err != nil {
		failure(c, http.StatusNotFound, "USER_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Profile updated", map[string]interface{}{
		"id":          u.ID,
		"username":    u.Username,
		"email":       u.Email,
		"phone":       u.Phone,
		"avatar":      u.Avatar,
		"name":        u.Name,
		"lastLoginAt": u.LastLoginAt.UTC().Format(time.RFC3339),
	})
}

func handleChangePassword(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.NewPassword == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "new_password is required", nil)
		return
	}
	if err := services.User.ChangePassword(c.Request.Context(), username, payload.OldPassword, payload.NewPassword); err != nil {
		failure(c, http.StatusBadRequest, "INVALID_CREDENTIALS", err.Error(), nil)
		return
	}
	success(c, "Password changed", true)
}

func handleBindPhone(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		Phone string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Phone == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "phone is required", nil)
		return
	}
	u, err := services.User.BindPhone(c.Request.Context(), username, payload.Phone)
	if err != nil {
		failure(c, http.StatusNotFound, "USER_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Phone bound", map[string]interface{}{
		"phone":  u.Phone,
		"userId": u.ID,
	})
}

func handleBindEmail(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Email == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "email is required", nil)
		return
	}
	u, err := services.User.BindEmail(c.Request.Context(), username, payload.Email)
	if err != nil {
		failure(c, http.StatusNotFound, "USER_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Email bound", map[string]interface{}{
		"email":          u.Email,
		"email_verified": u.EmailVerified,
	})
}

func handleUploadAvatar(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		Avatar string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.Avatar == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "avatar is required", nil)
		return
	}
	u, err := services.User.UploadAvatar(c.Request.Context(), username, payload.Avatar)
	if err != nil {
		failure(c, http.StatusNotFound, "USER_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Avatar uploaded", map[string]interface{}{
		"avatar": u.Avatar,
	})
}

// Friend handlers
func handleFriendList(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	list, _ := services.Friend.List(c.Request.Context(), username)
	success(c, "Friend list", map[string]interface{}{
		"friends": list,
	})
}

func handleFriendAdd(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		FriendID string `json:"friend_id"`
		Username string `json:"username"`
		Nickname string `json:"nickname"`
		Notes    string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.FriendID == "" || payload.Username == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "friend_id and username are required", nil)
		return
	}
	friend, err := services.Friend.Add(c.Request.Context(), username, domain.Friend{
		ID:       payload.FriendID,
		Username: payload.Username,
		Nickname: payload.Nickname,
		Notes:    payload.Notes,
	})
	if err != nil {
		failure(c, http.StatusBadRequest, "FRIEND_ADD_FAILED", err.Error(), nil)
		return
	}
	success(c, "Friend added", friend)
}

func handleFriendRemove(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		FriendID string `json:"friend_id"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.FriendID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "friend_id is required", nil)
		return
	}
	removed, _ := services.Friend.Remove(c.Request.Context(), username, payload.FriendID)
	if !removed {
		failure(c, http.StatusNotFound, "FRIEND_NOT_FOUND", "Friend not found", nil)
		return
	}
	success(c, "Friend removed", true)
}

func handleFriendInfo(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	friendID := c.Query("friend_id")
	if friendID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "friend_id query required", nil)
		return
	}
	friend, err := services.Friend.Info(c.Request.Context(), username, friendID)
	if err != nil {
		failure(c, http.StatusNotFound, "FRIEND_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Friend info", friend)
}

func handleFriendSearch(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		query = c.Query("keyword")
	}
	results := services.Friend.Search(c.Request.Context(), query)
	success(c, "Search completed", map[string]interface{}{
		"query":   query,
		"results": results,
	})
}

// Device handlers
func handleDeviceRegister(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		DeviceID string `json:"device_id"`
		Name     string `json:"name"`
		Platform string `json:"platform"`
		Version  string `json:"version"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.DeviceID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "device_id is required", nil)
		return
	}
	device, err := services.Device.Register(c.Request.Context(), username, domain.Device{
		ID:       payload.DeviceID,
		Name:     payload.Name,
		Platform: payload.Platform,
		Version:  payload.Version,
	})
	if err != nil {
		failure(c, http.StatusBadRequest, "DEVICE_REGISTER_FAILED", err.Error(), nil)
		return
	}
	success(c, "Device registered", device)
}

func handleDeviceUnregister(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		DeviceID string `json:"device_id"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.DeviceID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "device_id is required", nil)
		return
	}
	removed, _ := services.Device.Unregister(c.Request.Context(), username, payload.DeviceID)
	if !removed {
		failure(c, http.StatusNotFound, "DEVICE_NOT_FOUND", "Device not found", nil)
		return
	}
	success(c, "Device unregistered", true)
}

func handleDeviceList(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	list, _ := services.Device.List(c.Request.Context(), username)
	success(c, "Device list", map[string]interface{}{
		"devices": list,
	})
}

func handleDeviceUpdate(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		DeviceID string `json:"device_id"`
		Name     string `json:"name"`
		Platform string `json:"platform"`
		Version  string `json:"version"`
		Active   *bool  `json:"active"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.DeviceID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "device_id is required", nil)
		return
	}
	device := domain.Device{
		ID:       payload.DeviceID,
		Name:     payload.Name,
		Platform: payload.Platform,
		Version:  payload.Version,
	}
	if payload.Active != nil {
		device.Active = *payload.Active
	}
	updated, err := services.Device.Update(c.Request.Context(), username, device)
	if err != nil {
		failure(c, http.StatusNotFound, "DEVICE_NOT_FOUND", err.Error(), nil)
		return
	}
	success(c, "Device updated", updated)
}

// Chat handlers
func handleChatConversations(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	list := services.Chat.Conversations(c.Request.Context(), username)
	success(c, "Conversations fetched", map[string]interface{}{
		"conversations": list,
	})
}

func handleChatMessages(c *gin.Context) {
	conversationID := c.Param("conversationId")
	if conversationID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "conversationId is required", nil)
		return
	}
	messages, _ := services.Chat.Messages(c.Request.Context(), conversationID)
	success(c, "Messages fetched", map[string]interface{}{
		"conversationId": conversationID,
		"messages":       messages,
	})
}

func handleChatSend(c *gin.Context) {
	username, ok := getUsername(c)
	if !ok {
		return
	}
	var payload struct {
		ConversationID string `json:"conversation_id"`
		To             string `json:"to"`
		Body           string `json:"body"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil || payload.To == "" || payload.Body == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "to and body are required", nil)
		return
	}
	msg, convID, err := services.Chat.Send(c.Request.Context(), username, payload.ConversationID, payload.To, payload.Body)
	if err != nil {
		failure(c, http.StatusBadRequest, "CHAT_SEND_FAILED", err.Error(), nil)
		return
	}
	success(c, "Message sent", map[string]interface{}{
		"conversationId": convID,
		"message":        msg,
	})
}

func handleChatHistory(c *gin.Context) {
	friendID := c.Param("friendId")
	history, _ := services.Chat.History(c.Request.Context(), friendID)
	success(c, "Chat history", map[string]interface{}{
		"friendId": friendID,
		"messages": history,
	})
}

func handleChatDelete(c *gin.Context) {
	messageID := c.Param("messageId")
	if messageID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "messageId is required", nil)
		return
	}
	success(c, "Message deleted", map[string]interface{}{
		"messageId": messageID,
		"deleted":   true,
	})
}

func handleChatMarkRead(c *gin.Context) {
	messageID := c.Param("messageId")
	if messageID == "" {
		failure(c, http.StatusBadRequest, "VALIDATION_FAILED", "messageId is required", nil)
		return
	}
	success(c, "Message marked as read", map[string]interface{}{
		"messageId": messageID,
		"read":      true,
	})
}

// Search handlers
func handleGlobalSearch(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		query = c.Query("keyword")
	}
	results := services.Search.Global(c.Request.Context(), query)
	success(c, "Search completed", map[string]interface{}{
		"query":   query,
		"results": results,
	})
}

func handleSearchUsers(c *gin.Context) {
	query := c.Query("q")
	results := services.Search.Users(c.Request.Context(), query)
	success(c, "User search completed", map[string]interface{}{
		"query":   query,
		"results": results,
	})
}

// Dashboard handlers
func handleDashboardStats(c *gin.Context) {
	stats := services.Dashboard.Stats(c.Request.Context())
	success(c, "Dashboard stats", stats)
}

func handleDashboardActivity(c *gin.Context) {
	success(c, "Recent activity", map[string]interface{}{
		"items": services.Dashboard.Activity(c.Request.Context()),
	})
}

func handleDashboardInsights(c *gin.Context) {
	success(c, "Insights", map[string]interface{}{
		"insights": services.Dashboard.Insights(c.Request.Context()),
	})
}

func getUsername(c *gin.Context) (string, bool) {
	raw, ok := c.Get("username")
	if !ok {
		failure(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing auth context", nil)
		return "", false
	}
	username, ok := raw.(string)
	if !ok {
		failure(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid auth context", nil)
		return "", false
	}
	return username, true
}

func success(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, apiResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

func failure(c *gin.Context, status int, code, message string, data interface{}) {
	c.JSON(status, apiResponse{
		Success: false,
		Error:   code,
		Message: message,
		Data:    data,
	})
}
