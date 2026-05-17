/**
 * Lightweight migration runner — used by Cloud Build since `prisma migrate deploy`
 * requires Node ≥20 (@prisma/dev ESM issue).
 *
 * Applies all .sql files in prisma/migrations/ in chronological order,
 * tracking applied migrations in a `_migrations` table (idempotent).
 *
 * Each migration SQL is split into individual statements and applied one by one.
 * "Already exists" errors (duplicate table/column/index/constraint) are silently
 * skipped so that partial-state or re-run scenarios are safe.
 */

const { Pool } = require("pg")
const fs = require("fs")
const path = require("path")

// PostgreSQL error codes that mean "object already exists" — safe to ignore
const ALREADY_EXISTS_CODES = new Set([
  "42P07", // duplicate_table
  "42701", // duplicate_column
  "42P16", // invalid_table_definition (duplicate constraint name sometimes)
  "23505", // unique_violation (duplicate index creation)
  "42710", // duplicate_object (constraint/index already exists)
])

async function runStatement(pool, sql) {
  const trimmed = sql.trim()
  if (!trimmed) return
  try {
    await pool.query(trimmed)
  } catch (err) {
    if (ALREADY_EXISTS_CODES.has(err.code)) {
      console.log(`    [exists] ${trimmed.slice(0, 80).replace(/\s+/g, " ")}…`)
      return
    }
    throw err
  }
}

function splitStatements(sql) {
  // Split on semicolons, preserving DO $$ ... $$ blocks
  const statements = []
  let current = ""
  let dollarDepth = 0
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    if (ch === "$" && sql[i + 1] === "$") {
      dollarDepth += dollarDepth === 0 ? 1 : -1
      current += "$$"
      i += 2
      continue
    }

    if (ch === ";" && dollarDepth === 0) {
      const stmt = current.trim()
      if (stmt) statements.push(stmt)
      current = ""
      i++
      continue
    }

    current += ch
    i++
  }

  const last = current.trim()
  if (last) statements.push(last)
  return statements
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("DATABASE_URL not set")
    process.exit(1)
  }

  const pool = new Pool({ connectionString })

  try {
    // Ensure tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "name" TEXT PRIMARY KEY,
        "applied_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    const migrationsDir = path.join(__dirname, "..", "prisma", "migrations")
    const allMigrations = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()

    for (const name of allMigrations) {
      const sqlPath = path.join(migrationsDir, name, "migration.sql")
      if (!fs.existsSync(sqlPath)) continue

      const { rows } = await pool.query(
        `SELECT 1 FROM "_migrations" WHERE "name" = $1`,
        [name]
      )
      if (rows.length > 0) {
        console.log(`  [skip]  ${name}`)
        continue
      }

      const sql = fs.readFileSync(sqlPath, "utf8")
      const statements = splitStatements(sql)

      console.log(`  [apply] ${name} (${statements.length} statements)`)
      for (const stmt of statements) {
        await runStatement(pool, stmt)
      }

      await pool.query(
        `INSERT INTO "_migrations" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
        [name]
      )
      console.log(`  [done]  ${name}`)
    }

    console.log("All migrations complete.")
  } catch (err) {
    console.error("Migration failed:", err.message, err.code ? `(code: ${err.code})` : "")
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
