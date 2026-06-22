package dao

import (
	"context"

	"appfactory-goframe/internal/model/entity"
	"github.com/gogf/gf/v2/database/gdb"
	"github.com/gogf/gf/v2/frame/g"
)

// User DAO for user table operations
type User struct{}

// NewUser creates a new User DAO
func NewUser() *User {
	return &User{}
}

// FindByEmail finds user by email
func (d *User) FindByEmail(ctx context.Context, email string) (*entity.User, error) {
	var user entity.User
	err := g.DB().Model("user").Where("email", email).Scan(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByUid finds user by UID
func (d *User) FindByUid(ctx context.Context, uid string) (*entity.User, error) {
	var user entity.User
	err := g.DB().Model("user").Where("uid", uid).Scan(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByRole finds users by role
func (d *User) FindByRole(ctx context.Context, role string) ([]*entity.User, error) {
	var users []*entity.User
	err := g.DB().Model("user").Where("role", role).Scan(&users)
	if err != nil {
		return nil, err
	}
	return users, nil
}

// Create creates a new user
func (d *User) Create(ctx context.Context, user *entity.User) error {
	result, err := g.DB().Model("user").Insert(user)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	user.Id = uint(id)
	return nil
}

// Update updates user
func (d *User) Update(ctx context.Context, uid string, data g.Map) error {
	_, err := g.DB().Model("user").Where("uid", uid).Update(data)
	return err
}

// Delete deletes user
func (d *User) Delete(ctx context.Context, uid string) error {
	_, err := g.DB().Model("user").Where("uid", uid).Delete()
	return err
}

// Count counts users by condition
func (d *User) Count(ctx context.Context, where ...interface{}) (int64, error) {
	var count int64
	err := g.DB().Model("user").Where(where...).Count(&count)
	return count, err
}
