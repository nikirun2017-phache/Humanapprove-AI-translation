/**
 * Lightweight migration runner — used by Cloud Build since `prisma migrate deploy`
 * requires Node ≥20 (@prisma/dev ESM issue) but Cloud Build's Node container may be older.
 *
 * Applies all .sql files in prisma/migrations/ in chronological order,
 * tracking applied migrations in a `_migrations` table so re-runs are idempotent.
 */

const { Pool } = require("pg")
const fs = require("fs")
const path = require("path")

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
    const entries = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()

    for (const name of entries) {
      const sqlPath = path.join(migrationsDir, name, "migration.sql")
      if (!fs.existsSync(sqlPath)) continue

      const { rows } = await pool.query(
        `SELECT 1 FROM "_migrations" WHERE "name" = $1`,
        [name]
      )
      if (rows.length > 0) {
        console.log(`  [skip] ${name} — already applied`)
        continue
      }

      const sql = fs.readFileSync(sqlPath, "utf8")
      console.log(`  [apply] ${name}`)
      await pool.query(sql)
      await pool.query(
        `INSERT INTO "_migrations" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
        [name]
      )
      console.log(`  [done]  ${name}`)
    }

    console.log("All migrations complete.")
  } catch (err) {
    console.error("Migration failed:", err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
