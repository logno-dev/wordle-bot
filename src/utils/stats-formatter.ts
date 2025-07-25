import { PlayerStats, EnhancedPlayerStats } from '../db/queries'

export const formatStatsMessage = (
  enhancedPlayerStats: EnhancedPlayerStats[],
  totalStats: any,
  recentActivity: any
): string => {
  if (enhancedPlayerStats.length === 0) {
    return `📊 *Wordle Stats*\n\nNo games recorded yet! Send a Wordle score to get started.`
  }

  const lines: string[] = []
  
  // Header
  lines.push('📊 *Wordle Leaderboard*')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  // Overall stats
  lines.push('🌍 *Overall Stats*')
  lines.push(`👥 Active Players: ${totalStats.totalPlayers}`)
  lines.push(`🎯 Total Games: ${totalStats.totalGames}`)
  lines.push(`📊 Overall Win Rate: ${totalStats.overallSuccessRate}%`)
  lines.push(`🔥 Recent Activity: ${recentActivity.gamesThisWeek} games this week`)
  lines.push('')

  // Player rankings - concise format
  lines.push('🏆 *Player Rankings*')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  enhancedPlayerStats.forEach((player: any) => {
    const name = truncateName(player.senderName)
    const score = Math.round(player.rankingScore)
    lines.push(`${player.rank}. ${name} - score: ${score}`)
  })

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('💡 *Ranking:* Win rate × Wins ÷ Average attempts')
  lines.push('📱 Send "!mystats" for detailed personal stats')

  return lines.join('\n')
}

export const formatPersonalStats = (playerName: string, stats: EnhancedPlayerStats | null): string => {
  if (!stats) {
    return `📊 *Personal Stats for ${truncateName(playerName)}*\n\nNo games recorded yet! Send a Wordle score to get started.`
  }

  const lines: string[] = []
  
  lines.push(`📊 *Personal Stats for ${truncateName(stats.senderName)}*`)
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(`🏆 Rank: #${stats.rank} - Score: ${Math.round(stats.rankingScore)}`)
  lines.push('')
  lines.push(`🎯 Total Games: ${stats.totalGames} (${stats.successfulGames} ✅, ${stats.failedGames} ❌)`)
  lines.push(`⭐ Average Attempts: ${stats.averageAttempts.toFixed(2)}`)
  lines.push(`🏅 Best Score: ${stats.bestScore || 'N/A'}`)
  lines.push(`📊 Win Rate: ${stats.winPercentage.toFixed(1)}%`)
  lines.push(`🔥 Current Streak: ${stats.currentStreak} | Max Streak: ${stats.maxStreak}`)
  lines.push('')
  lines.push('🎯 *Attempts Distribution:*')
  lines.push(`1️⃣ ${stats.wins1} | 2️⃣ ${stats.wins2} | 3️⃣ ${stats.wins3}`)
  lines.push(`4️⃣ ${stats.wins4} | 5️⃣ ${stats.wins5} | 6️⃣ ${stats.wins6}`)
  lines.push('')
  lines.push(getPerformanceEmoji(stats.averageAttempts, stats.winPercentage))

  return lines.join('\n')
}

const getMedal = (rank: number): string => {
  switch (rank) {
    case 1: return '🥇'
    case 2: return '🥈'
    case 3: return '🥉'
    default: return `${rank}.`
  }
}

const truncateName = (name: string): string => {
  return name.length > 15 ? name.substring(0, 12) + '...' : name
}

const getRankingScore = (player: PlayerStats): number => {
  // Formula: Games played × (7 - average score)
  // Higher is better (more games + lower average score)
  return Math.round(player.totalGames * (7 - player.averageScore))
}

const getPerformanceEmoji = (avgScore: number, successRate: number): string => {
  if (avgScore <= 3.5 && successRate >= 95) {
    return '🔥 *Wordle Master!* You\'re absolutely crushing it!'
  } else if (avgScore <= 4.0 && successRate >= 90) {
    return '⭐ *Excellent Player!* Consistently great performance!'
  } else if (avgScore <= 4.5 && successRate >= 80) {
    return '👍 *Solid Player!* Good consistent results!'
  } else if (successRate >= 70) {
    return '📈 *Getting Better!* Keep up the good work!'
  } else {
    return '💪 *Keep Practicing!* Every game makes you better!'
  }
}

export const formatWeeklyStatsMessage = (
  enhancedPlayerStats: EnhancedPlayerStats[],
  weekRange: string
): string => {
  if (enhancedPlayerStats.length === 0) {
    return `📊 *Weekly Wordle Stats (${weekRange})*\n\nNo games recorded this week yet!`
  }

  const lines: string[] = []
  
  // Header
  lines.push(`📊 *Weekly Wordle Leaderboard*`)
  lines.push(`📅 *${weekRange}*`)
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  // Weekly stats summary
  const totalGames = enhancedPlayerStats.reduce((sum: any, p: any) => sum + p.totalGames, 0)
  const totalWins = enhancedPlayerStats.reduce((sum: any, p: any) => sum + p.successfulGames, 0)
  const overallWinRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '0.0'

  lines.push('📈 *This Week*')
  lines.push(`👥 Active Players: ${enhancedPlayerStats.length}`)
  lines.push(`🎯 Total Games: ${totalGames}`)
  lines.push(`📊 Overall Win Rate: ${overallWinRate}%`)
  lines.push('')

  // Player rankings - concise format
  lines.push('🏆 *Weekly Rankings*')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  enhancedPlayerStats.forEach((player: any) => {
    const name = truncateName(player.senderName)
    const score = Math.round(player.rankingScore)
    lines.push(`${player.rank}. ${name} - score: ${score}`)
  })

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('💡 *Ranking:* Win rate × Wins ÷ Average attempts')
  lines.push('📱 Send "!mystats" for detailed personal stats')

  return lines.join('\n')
}