cmd
    └── main.go
DocumentTable.md
embed
    ├── caddy
        └── host.hbs
    └── main.go
generate_jwt_key.sh
go.mod
go.sum
internal
    ├── api
        ├── context
            └── context.go
        ├── handler
            ├── handler.go
            ├── helpers.go
            ├── hosts.go
            └── user.go
        ├── http
            ├── requests.go
            └── responses.go
        ├── middleware
            └── auth.go
        ├── router.go
        └── server.go
    ├── auth
        ├── auth.go
        ├── jwt.go
        └── keys.go
    ├── caddy
        ├── caddy.go
        └── exec.go
    ├── config
        ├── config.go
        ├── folders.go
        └── vars.go
    ├── database
        ├── models.go
        └── sqlite.go
    ├── errors
        └── errors.go
    ├── jobqueue
        ├── main.go
        ├── models.go
        └── worker.go
    ├── logger
        ├── config.go
        └── logger.go
    └── util
        ├── interfaces.go
        └── slices.go
scripts
    └── projectDirectoryPrinting.js
