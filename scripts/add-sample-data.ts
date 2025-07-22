import { db, schema } from '../src/db'

const sampleData = [
  // Alice - Excellent player
  { senderName: 'Alice', gameNumber: 1490, attempts: 3, date: '2025-01-15' },
  { senderName: 'Alice', gameNumber: 1491, attempts: 4, date: '2025-01-16' },
  { senderName: 'Alice', gameNumber: 1492, attempts: 2, date: '2025-01-17' },
  { senderName: 'Alice', gameNumber: 1493, attempts: 3, date: '2025-01-18' },
  { senderName: 'Alice', gameNumber: 1494, attempts: 4, date: '2025-01-19' },
  { senderName: 'Alice', gameNumber: 1495, attempts: 3, date: '2025-01-20' },

  // Bob - Good player
  { senderName: 'Bob', gameNumber: 1490, attempts: 4, date: '2025-01-15' },
  { senderName: 'Bob', gameNumber: 1491, attempts: 5, date: '2025-01-16' },
  { senderName: 'Bob', gameNumber: 1492, attempts: 3, date: '2025-01-17' },
  { senderName: 'Bob', gameNumber: 1493, attempts: 4, date: '2025-01-18' },
  { senderName: 'Bob', gameNumber: 1494, attempts: 6, date: '2025-01-19' },

  // Charlie - Average player
  { senderName: 'Charlie', gameNumber: 1493, attempts: 5, date: '2025-01-18' },
  { senderName: 'Charlie', gameNumber: 1494, attempts: 4, date: '2025-01-19' },
  { senderName: 'Charlie', gameNumber: 1495, attempts: 6, date: '2025-01-20' },

  // Diana - New player
  { senderName: 'Diana', gameNumber: 1495, attempts: 5, date: '2025-01-20' },
]

async function addSampleData() {
  try {
    console.log('Adding sample Wordle data...')
    
    for (const data of sampleData) {
      await db.insert(schema.wordleScores).values(data)
    }
    
    console.log(`✅ Added ${sampleData.length} sample Wordle scores`)
    console.log('Players: Alice (6 games), Bob (5 games), Charlie (3 games), Diana (1 game)')
    console.log('You can now test the !stats and !mystats commands')
  } catch (error) {
    console.error('Error adding sample data:', error)
  }
}

addSampleData()