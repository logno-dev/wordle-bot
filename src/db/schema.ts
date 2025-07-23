import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const wordleScores = sqliteTable('wordle_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  senderName: text('sender_name').notNull(),
  gameNumber: integer('game_number').notNull(),
  attempts: integer('attempts'), // null for failed attempts
  failed: integer('failed', { mode: 'boolean' }).notNull().default(false),
  date: text('date').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
})

export type WordleScore = typeof wordleScores.$inferInsert
