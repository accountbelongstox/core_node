package repository

import (
	"context"
	"time"

	"awuy_gin/internal/domain"
)

// DataStore abstracts persistence.
type DataStore interface {
	CreateUser(ctx context.Context, username, email, password, phone, name string) (*domain.User, error)
	FindUserByUsername(ctx context.Context, username string) (*domain.User, bool)
	FindUserByEmail(ctx context.Context, email string) (*domain.User, bool)
	FindUserByPhone(ctx context.Context, phone string) (*domain.User, bool)
	SetToken(username, token string)
	GetUsernameByToken(token string) (string, bool)
	RevokeToken(token string)
	AddResetToken(ctx context.Context, email, token string, expires time.Time) error
	GetResetToken(ctx context.Context, token string) (domain.ResetToken, bool)
	ClearResetToken(ctx context.Context, token string) error
	SetVerificationCode(ctx context.Context, phone, code string) error
	GetVerificationCode(ctx context.Context, phone string) (string, bool)
	UpsertFriend(ctx context.Context, username string, f domain.Friend) error
	RemoveFriend(ctx context.Context, username, friendID string) (bool, error)
	ListFriends(ctx context.Context, username string) ([]domain.Friend, error)
	AddDevice(ctx context.Context, username string, d domain.Device) error
	RemoveDevice(ctx context.Context, username, deviceID string) (bool, error)
	ListDevices(ctx context.Context, username string) ([]domain.Device, error)
	UpdateDevice(ctx context.Context, username string, d domain.Device) (bool, error)
	AppendMessage(ctx context.Context, convID string, msg domain.Message) error
	GetConversation(ctx context.Context, convID string) ([]domain.Message, error)
	Activities() []domain.Activity
}
