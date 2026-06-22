#!/usr/bin/env node

/**
 * Initialize the SQLite database using the schema in db/sqlite/schema.sql.
 *
 * Usage:
 *   node scripts/setup-sqlite.js [--force]
 */

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

let config
try {
  config = require('../config/config')
} catch (error) {
  // Fallback to example configuration if project has not been initialised yet
  config = require('../config/config.example')
}

const args = process.argv.slice(2)
const force = args.includes('--force')

const dbPath = config.datastore?.sqlite?.filename
if (!dbPath) {
  console.error('❌ SQLite filename is not configured (config.datastore.sqlite.filename).')
  process.exit(1)
}

const schemaPath = path.join(__dirname, '..', 'db', 'sqlite', 'schema.sql')

if (!fs.existsSync(schemaPath)) {
  console.error(`❌ Schema file not found at ${schemaPath}`)
  process.exit(1)
}

const targetDir = path.dirname(dbPath)
fs.mkdirSync(targetDir, { recursive: true })

if (fs.existsSync(dbPath) && !force) {
  console.error(`⚠️  Database already exists at ${dbPath}. Pass --force to reapply the schema.`)
  process.exit(1)
}

console.log('📦 Preparing SQLite database...')
console.log(`📁 Database file: ${dbPath}`)
console.log(`📄 Schema file:   ${schemaPath}`)

try {
  if (force && fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
    console.log('🧹 Existing database removed.')
  }

  const db = new Database(dbPath, {
    timeout: config.datastore?.sqlite?.busyTimeout || 5000
  })

  const pragma = config.datastore?.sqlite?.pragma || {}
  if (pragma.journalMode) {
    db.pragma(`journal_mode = ${pragma.journalMode}`)
  }
  if (pragma.synchronous) {
    db.pragma(`synchronous = ${pragma.synchronous}`)
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8')
  const statements = schemaSql
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean)

  db.exec('BEGIN TRANSACTION;')
  for (const statement of statements) {
    db.exec(`${statement};`)
  }
  db.exec('COMMIT;')

  console.log('✅ SQLite schema applied successfully.')
  db.close()
} catch (error) {
  console.error('💥 Failed to initialize SQLite database:', error)
  process.exit(1)
}
