package logic

import (
	"context"
	"time"

	"appfactory-goframe/internal/dao"
	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/errors/gerror"
	"github.com/gogf/gf/v2/frame/g"
	"github.com/gogf/gf/v2/util/guid"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Auth logic for authentication
type Auth struct {
	userDao *dao.User
}

// NewAuth creates a new Auth logic
func NewAuth() *Auth {
	return &Auth{
		userDao: dao.NewUser(),
	}
}

// Login handles user login
func (l *Auth) Login(ctx context.Context, email, password string) (*entity.User, string, error) {
	// Find user by email
	user, err := l.userDao.FindByEmail(ctx, email)
	if err != nil || user.Id == 0 {
		return nil, "", gerror.New("Invalid credentials")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, "", gerror.New("Invalid credentials")
	}

	// Update last login
	l.userDao.Update(ctx, user.Uid, g.Map{
		"last_login": time.Now(),
	})

	// Generate JWT token
	token, err := l.generateToken(ctx, user)
	if err != nil {
		return nil, "", gerror.New("Failed to generate token")
	}

	// Remove password from response
	user.Password = ""

	return user, token, nil
}

// Register handles user registration
func (l *Auth) Register(ctx context.Context, name, email, password, role, phone string) (*entity.User, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, gerror.New("Failed to hash password")
	}

	// Create user
	user := &entity.User{
		Uid:      guid.S(),
		Name:     name,
		Email:    email,
		Password: string(hashedPassword),
		Role:     role,
		Phone:    phone,
	}

	err = l.userDao.Create(ctx, user)
	if err != nil {
		return nil, gerror.New("Email already exists")
	}

	user.Password = ""
	return user, nil
}

// GetCurrentUser returns current user info
func (l *Auth) GetCurrentUser(ctx context.Context, userId string) (*entity.User, error) {
	user, err := l.userDao.FindByUid(ctx, userId)
	if err != nil || user.Id == 0 {
		return nil, gerror.New("User not found")
	}

	user.Password = ""
	return user, nil
}

// generateToken generates JWT token
func (l *Auth) generateToken(ctx context.Context, user *entity.User) (string, error) {
	secret := g.Cfg().MustGet(ctx, "jwt.secret").String()
	expire := g.Cfg().MustGet(ctx, "jwt.expire").Int()

	claims := jwt.MapClaims{
		"user_id": user.Uid,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Duration(expire) * time.Second).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
