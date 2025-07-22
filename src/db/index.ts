import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'
import { join } from 'path'

// Check if we're using a remote database or local file
const databaseUrl = process.env.DATABASE_URL
const authToken = process.env.DATABASE_AUTH_TOKEN

let client

if (databaseUrl && databaseUrl.startsWith('libsql://')) {
  // Remote libsql/Turso database
  console.log('Connecting to remote libsql database...')
  client = createClient({
    url: databaseUrl,
    authToken: authToken
  })
} else if (databaseUrl && (databaseUrl.startsWith('http://') || databaseUrl.startsWith('https://'))) {
  // Remote HTTP database
  console.log('Connecting to remote HTTP database...')
  client = createClient({
    url: databaseUrl,
    authToken: authToken
  })
} else {
  // Fallback to in-memory database (no file system issues)
  console.log('Using in-memory database (no remote database configured)...')
  client = createClient({
    url: ':memory:'
  })
}

export const db = drizzle(client, { schema })

export const initializeDatabase = async () => {
  try {
    // Only run migrations if we have a persistent database (not in-memory)
    if (process.env.DATABASE_URL && process.env.DATABASE_URL !== ':memory:') {
      console.log('Running database migrations...')
      await migrate(db, { migrationsFolder: join(process.cwd(), 'drizzle') })
      console.log('Database migrations completed successfully')
    } else {
      console.log('Skipping migrations for in-memory database')
    }
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization failed:', error)
    // Don't throw the error - let the app continue with basic functionality
  }
}

export { schema }