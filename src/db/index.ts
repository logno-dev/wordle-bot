import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'
import { join, dirname, resolve } from 'path'
import { mkdirSync, existsSync, writeFileSync } from 'fs'

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'wordle.db')

// Ensure the directory exists before creating the database
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// Ensure the database file exists (create empty file if it doesn't)
if (!existsSync(dbPath)) {
  writeFileSync(dbPath, '')
}

// Create libsql client with absolute path
const absolutePath = resolve(dbPath)
const client = createClient({
  url: `file:${absolutePath}`
})

export const db = drizzle(client, { schema })

export const initializeDatabase = () => {
  try {
    migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
  }
}

export { schema }