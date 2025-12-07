package config

import "os"

type Config struct {
	PGDSN    string
	HTTPPort string
}

func Load() Config {
	var cfg Config
	cfg.PGDSN = getenv("PG_DSN", "postgres://postgres:postgres@localhost:5432/awuy_gin?sslmode=disable")
	cfg.HTTPPort = getenv("HTTP_PORT", "8080")
	return cfg
}

func getenv(key, def string) string {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	return val
}
