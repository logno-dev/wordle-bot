import { PlayerStats } from '../db/queries'

export const formatStatsMessage = (
  playerStats: PlayerStats[],
  totalStats: any,
  recentActivity: any
): string => {
  if (playerStats.length === 0) {
    return `📊 *Wordle Stats*\n\nNo games recorded yet! Send a Wordle score to get started.`
  }

  const lines: string[] = []
  
  // Header
  lines.push('📊 *Wordle Leaderboard*')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  // Overall stats
  lines.push('🌍 *Overall Stats*')
  lines.push(`👥 Players: ${totalStats.totalPlayers}`)
  lines.push(`🎯 Total Games: ${totalStats.totalGames} (${totalStats.successfulGames} ✅, ${totalStats.failedGames} ❌)`)
  lines.push(`📈 Average Score: ${totalStats.overallAverage || 'N/A'}`)
  lines.push(`🏆 Best Ever: ${totalStats.bestEverScore || 'N/A'}`)
  lines.push(`📊 Success Rate: ${totalStats.overallSuccessRate}%`)
  lines.push(`🔥 Recent Activity: ${recentActivity.gamesThisWeek} games this week`)
  lines.push('')

  // Player rankings
  lines.push('🏆 *Player Rankings*')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  playerStats.forEach((player, index) => {
    const medal = getMedal(index + 1)
    const name = truncateName(player.senderName)
    const score = getRankingScore(player)
    
    lines.push(`${medal} *${name}*`)
    lines.push(`   📊 ${player.totalGames} games (${player.successfulGames} ✅, ${player.failedGames} ❌)`)
    lines.push(`   ⭐ ${player.averageScore || 'N/A'} avg | 🎯 ${player.successRate}% | 🏆 Best: ${player.bestScore || 'N/A'}`)
    lines.push(`   📈 Ranking Score: ${score}`)
    
    if (index < playerStats.length - 1) {
      lines.push('')
    }
  })

  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('💡 *Ranking:* Success rate × Successful games ÷ Average score')
  lines.push('📱 Send "!mystats" for personal detailed stats')

  return lines.join('\n')
}

export const formatPersonalStats = (playerName: string, stats: PlayerStats | null): string => {
  if (!stats) {
    return `📊 *Personal Stats for ${truncateName(playerName)}*\n\nNo games recorded yet! Send a Wordle score to get started.`
  }

  const lines: string[] = []
  
  lines.push(`📊 *Personal Stats for ${truncateName(stats.senderName)}*`)
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('')
  lines.push(`🏆 Rank: #${stats.rank}`)
  lines.push(`🎯 Total Games: ${stats.totalGames}`)
  lines.push(`⭐ Average Score: ${stats.averageScore}`)
  lines.push(`🏅 Best Score: ${stats.bestScore}`)
  lines.push(`📊 Success Rate: ${stats.successRate}%`)
  lines.push(`📈 Ranking Score: ${getRankingScore(stats)}`)
  lines.push('')
  lines.push(getPerformanceEmoji(stats.averageScore, stats.successRate))

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