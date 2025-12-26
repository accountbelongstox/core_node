package domain

import "time"

type User struct {
	ID            int64     `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	Name          string    `json:"name"`
	Avatar        string    `json:"avatar"`
	Password      string    `json:"-"`
	EmailVerified bool      `json:"emailVerified"`
	LastLoginAt   time.Time `json:"lastLoginAt"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type Device struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Platform     string    `json:"platform"`
	Version      string    `json:"version"`
	RegisteredAt time.Time `json:"registeredAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Active       bool      `json:"active"`
}

type Friend struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Nickname  string    `json:"nickname"`
	Status    string    `json:"status"`
	AddedAt   time.Time `json:"addedAt"`
	Notes     string    `json:"notes"`
	LastSeen  time.Time `json:"lastSeen"`
	Signature string    `json:"signature"`
}

type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversationId"`
	From           string    `json:"from"`
	To             string    `json:"to"`
	Body           string    `json:"body"`
	CreatedAt      time.Time `json:"createdAt"`
	Read           bool      `json:"read"`
}

type Activity struct {
	Timestamp time.Time `json:"timestamp"`
	Title     string    `json:"title"`
	Detail    string    `json:"detail"`
	Severity  string    `json:"severity"`
}

type ResetToken struct {
	Token     string
	Email     string
	ExpiresAt time.Time
}
