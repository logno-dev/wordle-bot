import { db } from './index'
import { wordleScores } from './schema'
import { sql, desc, asc } from 'drizzle-orm'

export interface PlayerStats {
  senderName: string
  totalGames: number
  successfulGames: number
  averageScore: number | null // null if no successful games
  bestScore: number | null
  worstScore: number | null
  successRate: number
  failedGames: number
  rank: number
}

export const getPlayerStats = async (): Promise<PlayerStats[]> => {
  const stats = await db
    .select({
      senderName: wordleScores.senderName,
      totalGames: sql<number>`count(*)`,
      successfulGames: sql<number>`count(case when ${wordleScores.failed} = 0 then 1 end)`,
      failedGames: sql<number>`count(case when ${wordleScores.failed} = 1 then 1 end)`,
      averageScore: sql<number>`round(avg(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end), 2)`,
      bestScore: sql<number>`min(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end)`,
      worstScore: sql<number>`max(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end)`,
      successRate: sql<number>`round((count(case when ${wordleScores.failed} = 0 then 1 end) * 100.0 / count(*)), 1)`
    })
    .from(wordleScores)
    .groupBy(wordleScores.senderName)
    .orderBy(
      desc(sql`count(case when ${wordleScores.failed} = 0 then 1 end)`), // More successful games first
      asc(sql`avg(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end)`) // Lower average is better
    )

  // Add ranking
  return stats.map((player, index) => ({
    ...player,
    rank: index + 1
  }))
}

export const getTotalStats = async () => {
  const result = await db
    .select({
      totalPlayers: sql<number>`count(distinct ${wordleScores.senderName})`,
      totalGames: sql<number>`count(*)`,
      successfulGames: sql<number>`count(case when ${wordleScores.failed} = 0 then 1 end)`,
      failedGames: sql<number>`count(case when ${wordleScores.failed} = 1 then 1 end)`,
      overallAverage: sql<number>`round(avg(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end), 2)`,
      overallSuccessRate: sql<number>`round((count(case when ${wordleScores.failed} = 0 then 1 end) * 100.0 / count(*)), 1)`,
      bestEverScore: sql<number>`min(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end)`,
      worstEverScore: sql<number>`max(case when ${wordleScores.failed} = 0 then ${wordleScores.attempts} end)`
    })
    .from(wordleScores)

  return result[0] || {
    totalPlayers: 0,
    totalGames: 0,
    successfulGames: 0,
    failedGames: 0,
    overallAverage: 0,
    overallSuccessRate: 0,
    bestEverScore: 0,
    worstEverScore: 0
  }
}

export const getRecentActivity = async () => {
  const result = await db
    .select({
      gamesThisWeek: sql<number>`count(*)`,
      activePlayers: sql<number>`count(distinct ${wordleScores.senderName})`
    })
    .from(wordleScores)
    .where(sql`date(${wordleScores.date}) >= date('now', '-7 days')`)

  return result[0] || { gamesThisWeek: 0, activePlayers: 0 }
}