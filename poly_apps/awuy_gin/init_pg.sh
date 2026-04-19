#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${PGDATABASE:-awuy_gin}"
DB_USER="${PGUSER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_PASS="${PGPASSWORD:-postgres}"

PGPASSWORD="${DB_PASS}"

echo "Checking for psql..."
if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Please install PostgreSQL client/server first." >&2
  exit 1
fi

echo "Ensuring database ${DB_NAME} exists..."
if ! psql -h "${DB_HOST}" -U "${DB_USER}" -p "${DB_PORT}" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  createdb -h "${DB_HOST}" -U "${DB_USER}" -p "${DB_PORT}" "${DB_NAME}"
fi

echo "Applying schema..."
psql -h "${DB_HOST}" -U "${DB_USER}" -p "${DB_PORT}" -d "${DB_NAME}" <<'SQL'
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
SQL

echo "Done. Set PG_DSN if needed, e.g.:"
echo "  export PG_DSN=\"postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable\""
