import { getPlayerStats, getTotalStats, getRecentActivity } from '../src/db/queries'
import { formatStatsMessage, formatPersonalStats } from '../src/utils/stats-formatter'

async function testStats() {
  try {
    console.log('🧪 Testing stats functionality...\n')
    
    // Test database queries
    const [playerStats, totalStats, recentActivity] = await Promise.all([
      getPlayerStats(),
      getTotalStats(),
      getRecentActivity()
    ])
    
    console.log('📊 Player Stats:')
    console.log(JSON.stringify(playerStats, null, 2))
    console.log('\n📈 Total Stats:')
    console.log(JSON.stringify(totalStats, null, 2))
    console.log('\n🔥 Recent Activity:')
    console.log(JSON.stringify(recentActivity, null, 2))
    
    // Test formatted messages
    console.log('\n' + '='.repeat(50))
    console.log('📱 FORMATTED STATS MESSAGE:')
    console.log('='.repeat(50))
    const statsMessage = formatStatsMessage(playerStats, totalStats, recentActivity)
    console.log(statsMessage)
    
    console.log('\n' + '='.repeat(50))
    console.log('👤 PERSONAL STATS MESSAGE (Alice):')
    console.log('='.repeat(50))
    const aliceStats = playerStats.find(p => p.senderName === 'Alice')
    const personalMessage = formatPersonalStats('Alice', aliceStats || null)
    console.log(personalMessage)
    
    console.log('\n✅ Stats functionality test completed!')
    
  } catch (error) {
    console.error('❌ Error testing stats:', error)
  }
}

testStats()