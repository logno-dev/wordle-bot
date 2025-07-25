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

export interface EnhancedPlayerStats extends PlayerStats {
  currentStreak: number
  maxStreak: number
  wins1: number
  wins2: number
  wins3: number
  wins4: number
  wins5: number
  wins6: number
  winPercentage: number
  averageAttempts: number
  rankingScore: number
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

// Helper functions for weekly stats
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day
  d.setUTCDate(diff)
  return d
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + 6)
  d.setUTCHours(23, 59, 59, 999)
  return d
}

function formatWeek(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
  
  const startStr = weekStart.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    timeZone: 'UTC'
  })
  const endStr = weekEnd.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  
  return `${startStr} - ${endStr}`
}

export const getWeeklyPlayerStats = async (): Promise<{ players: EnhancedPlayerStats[], weekRange: string }> => {
  const now = new Date()
  const weekStart = getWeekStart(now)
  const weekEnd = getWeekEnd(weekStart)
  const weekRange = formatWeek(weekStart)

  // Get all scores from the current week
  const weeklyScores = await db
    .select()
    .from(wordleScores)
    .where(sql`${wordleScores.date} >= ${weekStart.toISOString()} AND ${wordleScores.date} <= ${weekEnd.toISOString()}`)
    .orderBy(desc(wordleScores.createdAt))

  if (weeklyScores.length === 0) {
    return { players: [], weekRange }
  }

  // Calculate stats per player for this week only
  const playerStats = new Map()

  weeklyScores.forEach(score => {
    const playerName = score.senderName

    if (!playerStats.has(playerName)) {
      playerStats.set(playerName, {
        senderName: playerName,
        totalGames: 0,
        successfulGames: 0,
        failedGames: 0,
        averageScore: 0,
        bestScore: null,
        worstScore: null,
        successRate: 0,
        rank: 0,
        currentStreak: 0,
        maxStreak: 0,
        winPercentage: 0,
        averageAttempts: 0,
        wins1: 0,
        wins2: 0,
        wins3: 0,
        wins4: 0,
        wins5: 0,
        wins6: 0,
        games: []
      })
    }

    const stats = playerStats.get(playerName)
    stats.totalGames++
    stats.games.push(score)

    if (!score.failed && score.attempts) {
      stats.successfulGames++
      stats[`wins${score.attempts}`]++
      if (!stats.bestScore || score.attempts < stats.bestScore) {
        stats.bestScore = score.attempts
      }
      if (!stats.worstScore || score.attempts > stats.worstScore) {
        stats.worstScore = score.attempts
      }
    } else {
      stats.failedGames++
    }
  })

  // Calculate derived stats for each player
  const players = Array.from(playerStats.values()).map((stats: any) => {
    // Calculate win percentage
    stats.winPercentage = stats.totalGames > 0 ? (stats.successfulGames / stats.totalGames) * 100 : 0

    // Calculate average attempts (only for wins)
    const totalAttempts = stats.wins1 * 1 + stats.wins2 * 2 + stats.wins3 * 3 +
      stats.wins4 * 4 + stats.wins5 * 5 + stats.wins6 * 6
    stats.averageAttempts = stats.successfulGames > 0 ? totalAttempts / stats.successfulGames : 0
    stats.averageScore = stats.averageAttempts

    // Calculate success rate
    stats.successRate = Math.round(stats.winPercentage * 10) / 10

    // Calculate streaks (sort games by game number)
    const sortedGames = stats.games.sort((a: any, b: any) => a.gameNumber - b.gameNumber)
    let currentStreak = 0
    let maxStreak = 0
    let tempStreak = 0

    // Calculate current streak (from most recent games backwards)
    const recentGames = [...sortedGames].reverse()
    for (const game of recentGames) {
      if (!game.failed) {
        currentStreak++
      } else {
        break
      }
    }

    // Calculate max streak
    for (const game of sortedGames) {
      if (!game.failed) {
        tempStreak++
        maxStreak = Math.max(maxStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    stats.currentStreak = currentStreak
    stats.maxStreak = maxStreak

    // Calculate ranking score: success_rate * successful_games / average_score * 100
    stats.rankingScore = stats.successfulGames > 0 && stats.averageAttempts > 0 
      ? ((stats.winPercentage / 100) * stats.successfulGames / stats.averageAttempts) * 100
      : 0

    // Remove games array from final output
    delete stats.games

    return stats
  })

  // Sort players by ranking score
  players.sort((a, b) => b.rankingScore - a.rankingScore)

  // Add ranking
  const rankedPlayers = players.map((player, index) => ({
    ...player,
    rank: index + 1
  }))

  return { players: rankedPlayers, weekRange }
}

export const getEnhancedPlayerStats = async (): Promise<EnhancedPlayerStats[]> => {
  // Get all scores from the existing table
  const allScores = await db.select().from(wordleScores).orderBy(desc(wordleScores.createdAt))

  // Calculate stats per player
  const playerStats = new Map()

  allScores.forEach(score => {
    const playerName = score.senderName

    if (!playerStats.has(playerName)) {
      playerStats.set(playerName, {
        senderName: playerName,
        totalGames: 0,
        successfulGames: 0,
        failedGames: 0,
        averageScore: 0,
        bestScore: null,
        worstScore: null,
        successRate: 0,
        rank: 0,
        currentStreak: 0,
        maxStreak: 0,
        winPercentage: 0,
        averageAttempts: 0,
        wins1: 0,
        wins2: 0,
        wins3: 0,
        wins4: 0,
        wins5: 0,
        wins6: 0,
        games: []
      })
    }

    const stats = playerStats.get(playerName)
    stats.totalGames++
    stats.games.push(score)

    if (!score.failed && score.attempts) {
      stats.successfulGames++
      stats[`wins${score.attempts}`]++
      if (!stats.bestScore || score.attempts < stats.bestScore) {
        stats.bestScore = score.attempts
      }
      if (!stats.worstScore || score.attempts > stats.worstScore) {
        stats.worstScore = score.attempts
      }
    } else {
      stats.failedGames++
    }
  })

  // Calculate derived stats for each player
  const players = Array.from(playerStats.values()).map((stats: any) => {
    // Calculate win percentage
    stats.winPercentage = stats.totalGames > 0 ? (stats.successfulGames / stats.totalGames) * 100 : 0

    // Calculate average attempts (only for wins)
    const totalAttempts = stats.wins1 * 1 + stats.wins2 * 2 + stats.wins3 * 3 +
      stats.wins4 * 4 + stats.wins5 * 5 + stats.wins6 * 6
    stats.averageAttempts = stats.successfulGames > 0 ? totalAttempts / stats.successfulGames : 0
    stats.averageScore = stats.averageAttempts

    // Calculate success rate
    stats.successRate = Math.round(stats.winPercentage * 10) / 10

    // Calculate streaks (sort games by game number)
    const sortedGames = stats.games.sort((a: any, b: any) => a.gameNumber - b.gameNumber)
    let currentStreak = 0
    let maxStreak = 0
    let tempStreak = 0

    // Calculate current streak (from most recent games backwards)
    const recentGames = [...sortedGames].reverse()
    for (const game of recentGames) {
      if (!game.failed) {
        currentStreak++
      } else {
        break
      }
    }

    // Calculate max streak
    for (const game of sortedGames) {
      if (!game.failed) {
        tempStreak++
        maxStreak = Math.max(maxStreak, tempStreak)
      } else {
        tempStreak = 0
      }
    }

    stats.currentStreak = currentStreak
    stats.maxStreak = maxStreak

    // Calculate ranking score: success_rate * successful_games / average_score * 100
    stats.rankingScore = stats.successfulGames > 0 && stats.averageAttempts > 0 
      ? ((stats.winPercentage / 100) * stats.successfulGames / stats.averageAttempts) * 100
      : 0

    // Remove games array from final output
    delete stats.games

    return stats
  })

  // Sort players by ranking score
  players.sort((a, b) => b.rankingScore - a.rankingScore)

  // Add ranking
  return players.map((player, index) => ({
    ...player,
    rank: index + 1
  }))
}