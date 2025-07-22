import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'
import { join, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'wordle.db')

// Ensure the directory exists before creating the database
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(dbPath)
export const db = drizzle(sqlite, { schema })

export const initializeDatabase = () => {
  try {
    migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
  }
}

export { schema }