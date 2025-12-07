package auth

// RBACChecker defines role-based access checks.
type RBACChecker interface {
	HasRole(user string, role string) bool
	HasPermission(user string, permission string) bool
}

// NoopRBAC is a permissive implementation for development.
type NoopRBAC struct{}

func (n NoopRBAC) HasRole(user string, role string) bool {
	return true
}

func (n NoopRBAC) HasPermission(user string, permission string) bool {
	return true
}
