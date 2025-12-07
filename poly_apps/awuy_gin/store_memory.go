package main

import (
	"context"
	"errors"
	"sync"
	"time"

	"awuy_gin/internal/domain"
)

type memoryStore struct {
	mutex          sync.RWMutex
	users          map[string]*domain.User
	usersByEmail   map[string]*domain.User
	usersByPhone   map[string]*domain.User
	passwordResets map[string]domain.ResetToken
	verification   map[string]string
	devices        map[string][]domain.Device
	friends        map[string][]domain.Friend
	conversations  map[string][]domain.Message
	activities     []domain.Activity
	counter        int64
}

func newMemoryStore() *memoryStore {
	var s memoryStore
	s.users = make(map[string]*domain.User)
	s.usersByEmail = make(map[string]*domain.User)
	s.usersByPhone = make(map[string]*domain.User)
	s.passwordResets = make(map[string]domain.ResetToken)
	s.verification = make(map[string]string)
	s.devices = make(map[string][]domain.Device)
	s.friends = make(map[string][]domain.Friend)
	s.conversations = make(map[string][]domain.Message)
	s.activities = []domain.Activity{
		{Timestamp: time.Now().Add(-2 * time.Hour), Title: "Login", Detail: "demo logged in from web", Severity: "info"},
		{Timestamp: time.Now().Add(-90 * time.Minute), Title: "Device linked", Detail: "Added Pixel 8 device", Severity: "info"},
		{Timestamp: time.Now().Add(-30 * time.Minute), Title: "Friend request", Detail: "Accepted friend: alex", Severity: "low"},
	}
	s.counter = 1
	_, _ = s.CreateUser(context.Background(), "demo", "demo@example.com", "demo123", "+8613800138000", "Demo User")
	return &s
}

func (s *memoryStore) nextID() int64 {
	s.counter++
	return s.counter
}

func (s *memoryStore) CreateUser(ctx context.Context, username, email, password, phone, name string) (*domain.User, error) {
	var exists bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	_, exists = s.users[username]
	if exists {
		return nil, errors.New("username exists")
	}
	if email != "" {
		_, exists = s.usersByEmail[email]
		if exists {
			return nil, errors.New("email exists")
		}
	}
	if phone != "" {
		_, exists = s.usersByPhone[phone]
		if exists {
			return nil, errors.New("phone exists")
		}
	}
	var now time.Time
	now = time.Now()
	var u domain.User
	u.ID = s.nextID()
	u.Username = username
	u.Email = email
	u.Phone = phone
	u.Password = password
	u.Name = name
	u.LastLoginAt = now
	u.CreatedAt = now
	u.UpdatedAt = now
	s.users[username] = &u
	if email != "" {
		s.usersByEmail[email] = &u
	}
	if phone != "" {
		s.usersByPhone[phone] = &u
	}
	s.friends[username] = []domain.Friend{}
	s.devices[username] = []domain.Device{}
	return &u, nil
}

func (s *memoryStore) FindUserByUsername(ctx context.Context, username string) (*domain.User, bool) {
	var u *domain.User
	var ok bool
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	u, ok = s.users[username]
	return u, ok
}

func (s *memoryStore) FindUserByEmail(ctx context.Context, email string) (*domain.User, bool) {
	var u *domain.User
	var ok bool
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	u, ok = s.usersByEmail[email]
	return u, ok
}

func (s *memoryStore) FindUserByPhone(ctx context.Context, phone string) (*domain.User, bool) {
	var u *domain.User
	var ok bool
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	u, ok = s.usersByPhone[phone]
	return u, ok
}

func (s *memoryStore) SetToken(username, token string) {
	tokenStore.Store(token, username)
}

func (s *memoryStore) GetUsernameByToken(token string) (string, bool) {
	var v interface{}
	var ok bool
	v, ok = tokenStore.Load(token)
	if !ok {
		return "", false
	}
	var username string
	username, ok = v.(string)
	return username, ok
}

func (s *memoryStore) RevokeToken(token string) {
	tokenStore.Delete(token)
}

func (s *memoryStore) AddResetToken(ctx context.Context, email, token string, expires time.Time) error {
	var entry domain.ResetToken
	entry.Email = email
	entry.Token = token
	entry.ExpiresAt = expires
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.passwordResets[token] = entry
	return nil
}

func (s *memoryStore) GetResetToken(ctx context.Context, token string) (domain.ResetToken, bool) {
	var entry domain.ResetToken
	var ok bool
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	entry, ok = s.passwordResets[token]
	return entry, ok
}

func (s *memoryStore) ClearResetToken(ctx context.Context, token string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	delete(s.passwordResets, token)
	return nil
}

func (s *memoryStore) SetVerificationCode(ctx context.Context, phone, code string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.verification[phone] = code
	return nil
}

func (s *memoryStore) GetVerificationCode(ctx context.Context, phone string) (string, bool) {
	var code string
	var ok bool
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	code, ok = s.verification[phone]
	return code, ok
}

func (s *memoryStore) UpsertFriend(ctx context.Context, username string, f domain.Friend) error {
	var list []domain.Friend
	var existing bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	list, existing = s.friends[username]
	if !existing {
		s.friends[username] = []domain.Friend{f}
		return nil
	}
	for index, item := range list {
		if item.ID == f.ID {
			list[index] = f
			s.friends[username] = list
			return nil
		}
	}
	s.friends[username] = append(list, f)
	return nil
}

func (s *memoryStore) RemoveFriend(ctx context.Context, username, friendID string) (bool, error) {
	var list []domain.Friend
	var ok bool
	var updated []domain.Friend
	var removed bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	list, ok = s.friends[username]
	if !ok {
		return false, nil
	}
	for _, item := range list {
		if item.ID == friendID {
			removed = true
			continue
		}
		updated = append(updated, item)
	}
	s.friends[username] = updated
	return removed, nil
}

func (s *memoryStore) ListFriends(ctx context.Context, username string) ([]domain.Friend, error) {
	var list []domain.Friend
	s.mutex.RLock()
	list = s.friends[username]
	s.mutex.RUnlock()
	return list, nil
}

func (s *memoryStore) AddDevice(ctx context.Context, username string, d domain.Device) error {
	var list []domain.Device
	var ok bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	list, ok = s.devices[username]
	if !ok {
		s.devices[username] = []domain.Device{d}
		return nil
	}
	s.devices[username] = append(list, d)
	return nil
}

func (s *memoryStore) RemoveDevice(ctx context.Context, username, deviceID string) (bool, error) {
	var list []domain.Device
	var ok bool
	var result []domain.Device
	var removed bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	list, ok = s.devices[username]
	if !ok {
		return false, nil
	}
	for _, item := range list {
		if item.ID == deviceID {
			removed = true
			continue
		}
		result = append(result, item)
	}
	s.devices[username] = result
	return removed, nil
}

func (s *memoryStore) ListDevices(ctx context.Context, username string) ([]domain.Device, error) {
	var list []domain.Device
	s.mutex.RLock()
	list = s.devices[username]
	s.mutex.RUnlock()
	return list, nil
}

func (s *memoryStore) UpdateDevice(ctx context.Context, username string, d domain.Device) (bool, error) {
	var list []domain.Device
	var ok bool
	var updated bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	list, ok = s.devices[username]
	if !ok {
		return false, nil
	}
	for index, item := range list {
		if item.ID == d.ID {
			list[index] = d
			updated = true
		}
	}
	s.devices[username] = list
	return updated, nil
}

func (s *memoryStore) AppendMessage(ctx context.Context, convID string, msg domain.Message) error {
	var list []domain.Message
	var ok bool
	s.mutex.Lock()
	defer s.mutex.Unlock()
	list, ok = s.conversations[convID]
	if !ok {
		s.conversations[convID] = []domain.Message{msg}
		return nil
	}
	s.conversations[convID] = append(list, msg)
	return nil
}

func (s *memoryStore) GetConversation(ctx context.Context, convID string) ([]domain.Message, error) {
	var list []domain.Message
	s.mutex.RLock()
	list = s.conversations[convID]
	s.mutex.RUnlock()
	return list, nil
}

func (s *memoryStore) Activities() []domain.Activity {
	return s.activities
}
