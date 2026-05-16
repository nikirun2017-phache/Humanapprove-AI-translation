/**
 * Lightweight migration runner — used by Cloud Build since `prisma migrate deploy`
 * requires Node ≥20 (@prisma/dev ESM issue).
 *
 * Applies all .sql files in prisma/migrations/ in chronological order,
 * tracking applied migrations in a `_migrations` table (idempotent).
 *
 * On first run, if the User table already exists (i.e. the schema was bootstrapped
 * outside this tracker), it pre-seeds all already-applied migrations so that only
 * genuinely new ones are applied.
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

    // Detect if the DB was bootstrapped before this tracker existed.
    // If "User" table is present but _migrations is empty, pre-seed all migrations
    // up to (but not including) the ones we actually need to apply.
    const { rows: trackerRows } = await pool.query(`SELECT COUNT(*) AS cnt FROM "_migrations"`)
    const { rows: userTableRows } = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
      LIMIT 1
    `)

    const trackerEmpty = Number(trackerRows[0].cnt) === 0
    const userTableExists = userTableRows.length > 0

    const migrationsDir = path.join(__dirname, "..", "prisma", "migrations")
    const allMigrations = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()

    if (trackerEmpty && userTableExists) {
      // Pre-seed: mark all migrations that don't add NEW columns/tables as applied.
      // We detect "new" migrations by checking if their columns/tables exist.
      console.log("Detected pre-existing schema — checking which migrations are already applied...")

      for (const name of allMigrations) {
        const sqlPath = path.join(migrationsDir, name, "migration.sql")
        if (!fs.existsSync(sqlPath)) continue

        const sql = fs.readFileSync(sqlPath, "utf8")

        // Check if this migration's changes already exist in the DB
        const alreadyApplied = await isMigrationAlreadyApplied(pool, name, sql)

        if (alreadyApplied) {
          await pool.query(
            `INSERT INTO "_migrations" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
            [name]
          )
          console.log(`  [seed]  ${name} — already applied`)
        } else {
          console.log(`  [todo]  ${name} — needs to be applied`)
        }
      }
    }

    // Now apply any unapplied migrations
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

/**
 * Heuristic: a migration is "already applied" if its key tables/columns exist.
 * Falls back to true (assume applied) if we can't determine.
 */
async function isMigrationAlreadyApplied(pool, name, sql) {
  // Extract CREATE TABLE table_name and ALTER TABLE ... ADD COLUMN col_name from the SQL
  // If all referenced tables/columns exist → already applied

  // Check for new tables created
  const createTableMatches = [...sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/gi)]
  for (const match of createTableMatches) {
    const tableName = match[1]
    if (tableName === "_migrations") continue
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
      [tableName]
    )
    if (rows.length === 0) return false // Table doesn't exist yet → not applied
  }

  // Check for new columns added
  const addColumnMatches = [...sql.matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/gi)]
  // We need the table name for these — extract from context
  const alterMatches = [...sql.matchAll(/ALTER TABLE\s+"([^"]+)"[\s\S]*?ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/gi)]
  for (const match of alterMatches) {
    const tableName = match[1]
    const colName = match[2]
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
      [tableName, colName]
    )
    if (rows.length === 0) return false // Column doesn't exist → not applied
  }

  return true // All checks passed → assume already applied
}

main()
