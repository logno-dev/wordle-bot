import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { join } from 'path'

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'wordle.db')
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