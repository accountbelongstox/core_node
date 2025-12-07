package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"awuy_gin/internal/domain"
	"awuy_gin/internal/repository"
)

type Services struct {
	Auth      *AuthService
	User      *UserService
	Friend    *FriendService
	Device    *DeviceService
	Chat      *ChatService
	Search    *SearchService
	Dashboard *DashboardService
}

func NewServices(repo repository.DataStore) *Services {
	return &Services{
		Auth:      &AuthService{repo: repo},
		User:      &UserService{repo: repo},
		Friend:    &FriendService{repo: repo},
		Device:    &DeviceService{repo: repo},
		Chat:      &ChatService{repo: repo},
		Search:    &SearchService{repo: repo},
		Dashboard: &DashboardService{repo: repo},
	}
}

type AuthService struct {
	repo repository.DataStore
}

func (s *AuthService) Register(ctx context.Context, username, email, password, name string) (*domain.User, string, string, error) {
	user, err := s.repo.CreateUser(ctx, username, email, password, "", name)
	if err != nil {
		return nil, "", "", err
	}
	token := newToken(user.Username)
	refresh := newRefreshToken(user.Username)
	s.repo.SetToken(user.Username, token)
	return user, token, refresh, nil
}

func (s *AuthService) Login(ctx context.Context, username, password string) (*domain.User, string, string, error) {
	user, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok || user.Password != password {
		return nil, "", "", errors.New("invalid username or password")
	}
	user.LastLoginAt = time.Now()
	token := newToken(user.Username)
	refresh := newRefreshToken(user.Username)
	s.repo.SetToken(user.Username, token)
	return user, token, refresh, nil
}

func (s *AuthService) Logout(token string) {
	if token != "" {
		s.repo.RevokeToken(token)
	}
}

func (s *AuthService) VerifyEmail(ctx context.Context, email, code string) error {
	user, ok := s.repo.FindUserByEmail(ctx, email)
	if !ok {
		return errors.New("user not found")
	}
	if code != "123456" {
		return errors.New("invalid verification code")
	}
	user.EmailVerified = true
	return nil
}

func (s *AuthService) ForgotPassword(ctx context.Context, email string) (domain.ResetToken, error) {
	_, ok := s.repo.FindUserByEmail(ctx, email)
	if !ok {
		return domain.ResetToken{}, errors.New("user not found")
	}
	token := newToken(email)
	expires := time.Now().Add(time.Hour)
	err := s.repo.AddResetToken(ctx, email, token, expires)
	if err != nil {
		return domain.ResetToken{}, err
	}
	return domain.ResetToken{Token: token, Email: email, ExpiresAt: expires}, nil
}

func (s *AuthService) ResetPassword(ctx context.Context, email, token, password string) error {
	rt, ok := s.repo.GetResetToken(ctx, token)
	if !ok || rt.Email != email || rt.ExpiresAt.Before(time.Now()) {
		return errors.New("invalid or expired token")
	}
	user, ok := s.repo.FindUserByEmail(ctx, email)
	if !ok {
		return errors.New("user not found")
	}
	user.Password = password
	user.UpdatedAt = time.Now()
	_ = s.repo.ClearResetToken(ctx, token)
	return nil
}

func (s *AuthService) SendSms(ctx context.Context, phone, countryCode string) (string, int, string, error) {
	code := "123456"
	if err := s.repo.SetVerificationCode(ctx, phone, code); err != nil {
		return "", 0, "", err
	}
	return "sms-" + strconv.FormatInt(time.Now().UnixNano(), 10), 60, code, nil
}

func (s *AuthService) PhoneLogin(ctx context.Context, phone, verificationCode string) (*domain.User, string, string, error) {
	stored, ok := s.repo.GetVerificationCode(ctx, phone)
	if !ok || stored != verificationCode {
		return nil, "", "", errors.New("invalid verification code")
	}
	user, ok := s.repo.FindUserByPhone(ctx, phone)
	if !ok {
		return nil, "", "", errors.New("user not found")
	}
	token := newToken(user.Username)
	refresh := newRefreshToken(user.Username)
	s.repo.SetToken(user.Username, token)
	user.LastLoginAt = time.Now()
	return user, token, refresh, nil
}

type UserService struct {
	repo repository.DataStore
}

func (s *UserService) Profile(ctx context.Context, username string) (*domain.User, error) {
	u, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, username, name, avatar, phone string) (*domain.User, error) {
	u, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok {
		return nil, errors.New("user not found")
	}
	if name != "" {
		u.Name = name
	}
	if avatar != "" {
		u.Avatar = avatar
	}
	if phone != "" {
		u.Phone = phone
	}
	u.UpdatedAt = time.Now()
	return u, nil
}

func (s *UserService) ChangePassword(ctx context.Context, username, oldPassword, newPassword string) error {
	u, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok {
		return errors.New("user not found")
	}
	if u.Password != "" && oldPassword != "" && u.Password != oldPassword {
		return errors.New("old password mismatch")
	}
	u.Password = newPassword
	u.UpdatedAt = time.Now()
	return nil
}

func (s *UserService) BindPhone(ctx context.Context, username, phone string) (*domain.User, error) {
	u, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok {
		return nil, errors.New("user not found")
	}
	u.Phone = phone
	u.UpdatedAt = time.Now()
	return u, nil
}

func (s *UserService) BindEmail(ctx context.Context, username, email string) (*domain.User, error) {
	u, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok {
		return nil, errors.New("user not found")
	}
	u.Email = email
	u.EmailVerified = false
	u.UpdatedAt = time.Now()
	return u, nil
}

func (s *UserService) UploadAvatar(ctx context.Context, username, avatar string) (*domain.User, error) {
	u, ok := s.repo.FindUserByUsername(ctx, username)
	if !ok {
		return nil, errors.New("user not found")
	}
	u.Avatar = avatar
	u.UpdatedAt = time.Now()
	return u, nil
}

type FriendService struct {
	repo repository.DataStore
}

func (s *FriendService) List(ctx context.Context, username string) ([]domain.Friend, error) {
	return s.repo.ListFriends(ctx, username)
}

func (s *FriendService) Add(ctx context.Context, username string, f domain.Friend) (domain.Friend, error) {
	f.AddedAt = time.Now()
	f.LastSeen = time.Now()
	f.Status = "accepted"
	if err := s.repo.UpsertFriend(ctx, username, f); err != nil {
		return domain.Friend{}, err
	}
	return f, nil
}

func (s *FriendService) Remove(ctx context.Context, username, friendID string) (bool, error) {
	return s.repo.RemoveFriend(ctx, username, friendID)
}

func (s *FriendService) Info(ctx context.Context, username, friendID string) (domain.Friend, error) {
	list, err := s.repo.ListFriends(ctx, username)
	if err != nil {
		return domain.Friend{}, err
	}
	for _, item := range list {
		if item.ID == friendID {
			return item, nil
		}
	}
	return domain.Friend{}, errors.New("friend not found")
}

func (s *FriendService) Search(ctx context.Context, query string) []domain.Friend {
	return []domain.Friend{
		{ID: "f-100", Username: "alex", Nickname: "Alex", Status: "suggested", AddedAt: time.Now().Add(-24 * time.Hour), Notes: "People you may know"},
		{ID: "f-101", Username: "jamie", Nickname: "Jamie", Status: "suggested", AddedAt: time.Now().Add(-48 * time.Hour), Notes: "Shares 2 mutual friends"},
	}
}

type DeviceService struct {
	repo repository.DataStore
}

func (s *DeviceService) Register(ctx context.Context, username string, d domain.Device) (domain.Device, error) {
	d.RegisteredAt = time.Now()
	d.UpdatedAt = d.RegisteredAt
	d.Active = true
	if err := s.repo.AddDevice(ctx, username, d); err != nil {
		return domain.Device{}, err
	}
	return d, nil
}

func (s *DeviceService) Unregister(ctx context.Context, username, deviceID string) (bool, error) {
	return s.repo.RemoveDevice(ctx, username, deviceID)
}

func (s *DeviceService) List(ctx context.Context, username string) ([]domain.Device, error) {
	return s.repo.ListDevices(ctx, username)
}

func (s *DeviceService) Update(ctx context.Context, username string, d domain.Device) (domain.Device, error) {
	d.UpdatedAt = time.Now()
	_, err := s.repo.UpdateDevice(ctx, username, d)
	return d, err
}

type ChatService struct {
	repo repository.DataStore
}

func (s *ChatService) Conversations(ctx context.Context, username string) []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":           "conv-1",
			"title":        "General",
			"unread":       1,
			"lastMessage":  "Welcome to Awuy chat",
			"updatedAt":    time.Now().Add(-5 * time.Minute).UTC().Format(time.RFC3339),
			"participants": []string{username, "alex"},
		},
	}
}

func (s *ChatService) Messages(ctx context.Context, convID string) ([]domain.Message, error) {
	return s.repo.GetConversation(ctx, convID)
}

func (s *ChatService) Send(ctx context.Context, username string, convID, to, body string) (domain.Message, string, error) {
	if convID == "" {
		convID = "conv-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	msg := domain.Message{
		ID:             "msg-" + strconv.FormatInt(time.Now().UnixNano(), 10),
		ConversationID: convID,
		From:           username,
		To:             to,
		Body:           body,
		CreatedAt:      time.Now(),
		Read:           false,
	}
	if err := s.repo.AppendMessage(ctx, convID, msg); err != nil {
		return domain.Message{}, "", err
	}
	return msg, convID, nil
}

func (s *ChatService) History(ctx context.Context, friendID string) ([]domain.Message, error) {
	return s.repo.GetConversation(ctx, "conv-h-"+friendID)
}

type SearchService struct {
	repo repository.DataStore
}

func (s *SearchService) Global(ctx context.Context, query string) []map[string]interface{} {
	return []map[string]interface{}{
		{"type": "user", "id": "demo", "username": "demo", "name": "Demo User"},
		{"type": "message", "id": "msg-123", "preview": "Welcome to Awuy Gin"},
	}
}

func (s *SearchService) Users(ctx context.Context, query string) []map[string]interface{} {
	return []map[string]interface{}{
		{"id": "demo", "username": "demo", "email": "demo@example.com"},
		{"id": "alex", "username": "alex", "email": "alex@example.com"},
	}
}

type DashboardService struct {
	repo repository.DataStore
}

func (s *DashboardService) Stats(ctx context.Context) map[string]interface{} {
	return map[string]interface{}{
		"users":             "n/a",
		"activeSessions":    "n/a",
		"friendsTotal":      "n/a",
		"devicesTracked":    "n/a",
		"messagesDelivered": "n/a",
	}
}

func (s *DashboardService) Activity(ctx context.Context) []domain.Activity {
	return s.repo.Activities()
}

func (s *DashboardService) Insights(ctx context.Context) []map[string]interface{} {
	return []map[string]interface{}{
		{"title": "Weekly retention", "value": "92%", "trend": "up"},
		{"title": "Avg response time", "value": "120ms", "trend": "flat"},
		{"title": "Top region", "value": "APAC", "trend": "up"},
	}
}

func newToken(username string) string {
	var now int64
	now = time.Now().UnixNano()
	return fmt.Sprintf("t-%s-%d", username, now)
}

func newRefreshToken(username string) string {
	var now int64
	now = time.Now().UnixNano()
	return fmt.Sprintf("rt-%s-%d", username, now)
}
