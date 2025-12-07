package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"awuy_gin/internal/domain"
)

type pgStore struct {
	db         *sql.DB
	activities []domain.Activity
}

func newPgStore(dsn string) (*pgStore, error) {
	var db *sql.DB
	var err error
	db, err = sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)
	var ctx context.Context
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = db.PingContext(ctx)
	if err != nil {
		return nil, err
	}
	var store pgStore
	store.db = db
	store.activities = []domain.Activity{
		{Timestamp: time.Now().Add(-2 * time.Hour), Title: "Login", Detail: "demo logged in from web", Severity: "info"},
		{Timestamp: time.Now().Add(-90 * time.Minute), Title: "Device linked", Detail: "Added Pixel 8 device", Severity: "info"},
		{Timestamp: time.Now().Add(-30 * time.Minute), Title: "Friend request", Detail: "Accepted friend: alex", Severity: "low"},
	}
	_ = store.ensureSchema(ctx)
	_, _ = store.CreateUser(ctx, "demo", "demo@example.com", "demo123", "+8613800138000", "Demo User")
	return &store, nil
}

func (s *pgStore) ensureSchema(ctx context.Context) error {
	schema := `
CREATE TABLE IF NOT EXISTS awy_users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    password TEXT NOT NULL,
    name TEXT,
    avatar TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS awy_devices (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES awy_users(id),
    device_id TEXT UNIQUE NOT NULL,
    name TEXT,
    platform TEXT,
    version TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS awy_friends (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    nickname TEXT,
    notes TEXT,
    status TEXT,
    added_at TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    signature TEXT
);
CREATE TABLE IF NOT EXISTS awy_messages (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT,
    sender TEXT,
    recipient TEXT,
    body TEXT,
    created_at TIMESTAMPTZ,
    read BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS awy_verification_codes (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS awy_reset_tokens (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
`
	_, err := s.db.ExecContext(ctx, schema)
	return err
}

func (s *pgStore) CreateUser(ctx context.Context, username, email, password, phone, name string) (*domain.User, error) {
	var exists domain.User
	err := s.db.QueryRowContext(ctx, "SELECT id, username, email, phone, password, name, avatar, email_verified, last_login_at, created_at, updated_at FROM awy_users WHERE username=$1", username).
		Scan(&exists.ID, &exists.Username, &exists.Email, &exists.Phone, &exists.Password, &exists.Name, &exists.Avatar, &exists.EmailVerified, &exists.LastLoginAt, &exists.CreatedAt, &exists.UpdatedAt)
	if err == nil {
		return nil, errors.New("username exists")
	}
	_, err = s.db.ExecContext(ctx, "INSERT INTO awy_users (username, email, phone, password, name, last_login_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),NOW())",
		username, email, phone, password, name)
	if err != nil {
		return nil, err
	}
	return s.FindUserByUsername(ctx, username)
}

func (s *pgStore) FindUserByUsername(ctx context.Context, username string) (*domain.User, bool) {
	var u domain.User
	err := s.db.QueryRowContext(ctx, "SELECT id, username, email, phone, password, name, avatar, email_verified, last_login_at, created_at, updated_at FROM awy_users WHERE username=$1", username).
		Scan(&u.ID, &u.Username, &u.Email, &u.Phone, &u.Password, &u.Name, &u.Avatar, &u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, false
	}
	return &u, true
}

func (s *pgStore) FindUserByEmail(ctx context.Context, email string) (*domain.User, bool) {
	var u domain.User
	err := s.db.QueryRowContext(ctx, "SELECT id, username, email, phone, password, name, avatar, email_verified, last_login_at, created_at, updated_at FROM awy_users WHERE email=$1", email).
		Scan(&u.ID, &u.Username, &u.Email, &u.Phone, &u.Password, &u.Name, &u.Avatar, &u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, false
	}
	return &u, true
}

func (s *pgStore) FindUserByPhone(ctx context.Context, phone string) (*domain.User, bool) {
	var u domain.User
	err := s.db.QueryRowContext(ctx, "SELECT id, username, email, phone, password, name, avatar, email_verified, last_login_at, created_at, updated_at FROM awy_users WHERE phone=$1", phone).
		Scan(&u.ID, &u.Username, &u.Email, &u.Phone, &u.Password, &u.Name, &u.Avatar, &u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, false
	}
	return &u, true
}

func (s *pgStore) SetToken(username, token string) {
	tokenStore.Store(token, username)
}

func (s *pgStore) GetUsernameByToken(token string) (string, bool) {
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

func (s *pgStore) RevokeToken(token string) {
	tokenStore.Delete(token)
}

func (s *pgStore) AddResetToken(ctx context.Context, email, token string, expires time.Time) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO awy_reset_tokens (token, email, expires_at) VALUES ($1,$2,$3) ON CONFLICT (token) DO UPDATE SET email=EXCLUDED.email, expires_at=EXCLUDED.expires_at", token, email, expires)
	return err
}

func (s *pgStore) GetResetToken(ctx context.Context, token string) (domain.ResetToken, bool) {
	var rt domain.ResetToken
	err := s.db.QueryRowContext(ctx, "SELECT token, email, expires_at FROM awy_reset_tokens WHERE token=$1", token).
		Scan(&rt.Token, &rt.Email, &rt.ExpiresAt)
	if err != nil {
		return domain.ResetToken{}, false
	}
	return rt, true
}

func (s *pgStore) ClearResetToken(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM awy_reset_tokens WHERE token=$1", token)
	return err
}

func (s *pgStore) SetVerificationCode(ctx context.Context, phone, code string) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO awy_verification_codes (phone, code, created_at) VALUES ($1,$2,NOW()) ON CONFLICT (phone) DO UPDATE SET code=EXCLUDED.code, created_at=NOW()", phone, code)
	return err
}

func (s *pgStore) GetVerificationCode(ctx context.Context, phone string) (string, bool) {
	var code string
	err := s.db.QueryRowContext(ctx, "SELECT code FROM awy_verification_codes WHERE phone=$1", phone).Scan(&code)
	if err != nil {
		return "", false
	}
	return code, true
}

func (s *pgStore) UpsertFriend(ctx context.Context, username string, f domain.Friend) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO awy_friends (username, friend_id, nickname, notes, status, added_at, last_seen, signature) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
		username, f.ID, f.Nickname, f.Notes, f.Status, f.AddedAt, f.LastSeen, f.Signature)
	return err
}

func (s *pgStore) RemoveFriend(ctx context.Context, username, friendID string) (bool, error) {
	var res sql.Result
	var err error
	res, err = s.db.ExecContext(ctx, "DELETE FROM awy_friends WHERE username=$1 AND friend_id=$2", username, friendID)
	if err != nil {
		return false, err
	}
	var rows int64
	rows, _ = res.RowsAffected()
	return rows > 0, nil
}

func (s *pgStore) ListFriends(ctx context.Context, username string) ([]domain.Friend, error) {
	var rows *sql.Rows
	var err error
	rows, err = s.db.QueryContext(ctx, "SELECT friend_id, nickname, notes, status, added_at, last_seen, signature FROM awy_friends WHERE username=$1", username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []domain.Friend
	for rows.Next() {
		var f domain.Friend
		f.Username = username
		err = rows.Scan(&f.ID, &f.Nickname, &f.Notes, &f.Status, &f.AddedAt, &f.LastSeen, &f.Signature)
		if err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, nil
}

func (s *pgStore) AddDevice(ctx context.Context, username string, d domain.Device) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO awy_devices (user_id, device_id, name, platform, version, registered_at, updated_at, active) VALUES ((SELECT id FROM awy_users WHERE username=$1),$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (device_id) DO UPDATE SET name=EXCLUDED.name, platform=EXCLUDED.platform, version=EXCLUDED.version, updated_at=EXCLUDED.updated_at, active=EXCLUDED.active",
		username, d.ID, d.Name, d.Platform, d.Version, d.RegisteredAt, d.UpdatedAt, d.Active)
	return err
}

func (s *pgStore) RemoveDevice(ctx context.Context, username, deviceID string) (bool, error) {
	res, err := s.db.ExecContext(ctx, "DELETE FROM awy_devices WHERE device_id=$1 AND user_id=(SELECT id FROM awy_users WHERE username=$2)", deviceID, username)
	if err != nil {
		return false, err
	}
	var rows int64
	rows, _ = res.RowsAffected()
	return rows > 0, nil
}

func (s *pgStore) ListDevices(ctx context.Context, username string) ([]domain.Device, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT device_id, name, platform, version, registered_at, updated_at, active FROM awy_devices WHERE user_id=(SELECT id FROM awy_users WHERE username=$1)", username)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []domain.Device
	for rows.Next() {
		var d domain.Device
		err = rows.Scan(&d.ID, &d.Name, &d.Platform, &d.Version, &d.RegisteredAt, &d.UpdatedAt, &d.Active)
		if err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, nil
}

func (s *pgStore) UpdateDevice(ctx context.Context, username string, d domain.Device) (bool, error) {
	res, err := s.db.ExecContext(ctx, "UPDATE awy_devices SET name=$1, platform=$2, version=$3, active=$4, updated_at=$5 WHERE device_id=$6 AND user_id=(SELECT id FROM awy_users WHERE username=$7)",
		d.Name, d.Platform, d.Version, d.Active, d.UpdatedAt, d.ID, username)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

func (s *pgStore) AppendMessage(ctx context.Context, convID string, msg domain.Message) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO awy_messages (conversation_id, sender, recipient, body, created_at, read) VALUES ($1,$2,$3,$4,$5,$6)",
		convID, msg.From, msg.To, msg.Body, msg.CreatedAt, msg.Read)
	return err
}

func (s *pgStore) GetConversation(ctx context.Context, convID string) ([]domain.Message, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT id, conversation_id, sender, recipient, body, created_at, read FROM awy_messages WHERE conversation_id=$1 ORDER BY created_at DESC", convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []domain.Message
	for rows.Next() {
		var m domain.Message
		err = rows.Scan(&m.ID, &m.ConversationID, &m.From, &m.To, &m.Body, &m.CreatedAt, &m.Read)
		if err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

func (s *pgStore) Activities() []domain.Activity {
	return s.activities
}

func (s *pgStore) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *pgStore) ensureDemoFriend(ctx context.Context, username string) {
	_ = s.UpsertFriend(ctx, username, domain.Friend{
		ID:        "f-100",
		Username:  "alex",
		Nickname:  "Alex",
		Status:    "suggested",
		AddedAt:   time.Now(),
		Signature: "Auto-imported",
	})
}

func (s *pgStore) ensureDemoDevice(ctx context.Context, username string) {
	_ = s.AddDevice(ctx, username, domain.Device{
		ID:           "dev-demo",
		Name:         "Demo Device",
		Platform:     "web",
		Version:      "1.0",
		RegisteredAt: time.Now(),
		UpdatedAt:    time.Now(),
		Active:       true,
	})
}

func (s *pgStore) info() string {
	return fmt.Sprintf("postgres store %v", s.db.Stats())
}
