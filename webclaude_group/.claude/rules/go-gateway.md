---
paths:
  - "webclaude_go-gateway/**/*.go"
  - "webclaude_go-gateway/**/*.sh"
---

# Go Gateway Rules

- Uses uptrace/bun for multi-dialect DB (MySQL/SQLite/PostgreSQL)
- Legacy sqlx.DB kept for backward compat during migration
- CGO_ENABLED=0 for static builds
- Run `go mod tidy` if go.sum is incomplete before building
- GOPROXY and GOSUMDB must be set (may be empty on fresh installs)
- Go binary: /usr/local/go/bin or /www/*/go/bin — add to PATH
- Go install: via core_node 53_install_golang22.sh (set INSTALL_GO=true via gvar_common.sh)
