import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
  isJidGroup,
  jidNormalizedUser
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import { config } from 'dotenv'
import { db, initializeDatabase, schema } from './db'
import { parseWordleMessage } from './utils/wordle-parser'
import { getPlayerStats, getTotalStats, getRecentActivity } from './db/queries'
import { formatStatsMessage, formatPersonalStats } from './utils/stats-formatter'
import { getRandomFact } from './utils/random-fact'

config()

console.log('Environment check:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
  BOT_NAME: process.env.BOT_NAME || 'wordle-tracker-bot'
})

const connectToWhatsApp = async () => {
  // Initialize database
  await initializeDatabase()

  // Use multi-file auth state for session management
  const { state, saveCreds } = await useMultiFileAuthState('wordle-tracker-bot_sessions')

  const sock = makeWASocket({
    auth: state,
    browser: ['Wordle Tracker Bot', 'Chrome', '1.0.0']
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('QR Code generated, scan with WhatsApp')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect)

      if (shouldReconnect) {
        connectToWhatsApp()
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async (m) => {
    const message = m.messages[0]

    if (!message.message) return
    if (message.key.fromMe) return // Ignore messages from bot itself

    const messageText = message.message.conversation ||
      message.message.extendedTextMessage?.text || ''

    const from = message.key.remoteJid!
    const isGroup = isJidGroup(from)
    const senderJid = isGroup ? message.key.participant! : from
    const senderName = message.pushName || jidNormalizedUser(senderJid)

    console.log('Message received:', {
      from,
      senderJid,
      senderName,
      isGroup,
      text: messageText.substring(0, 50),
      timestamp: new Date().toISOString()
    })

    // Handle commands
    if (messageText.toLowerCase().includes('!stats')) {
      await handleStatsCommand(sock, from)
      return
    }

    if (messageText.toLowerCase().includes('!mystats')) {
      await handleMyStatsCommand(sock, from, senderName)
      return
    }

    if (messageText.toLowerCase().includes('!help')) {
      await handleHelpCommand(sock, from)
      return
    }

    if (messageText.toLowerCase().includes('!intro')) {
      await handleIntroCommand(sock, from)
      return
    }

    if (messageText.toLowerCase().includes('!hint')) {
      await handleHintCommand(sock, from)
      return
    }

    if (messageText.toLowerCase().includes('!fact')) {
      await handleFactCommand(sock, from)
      return
    }

    // Handle Wordle messages
    if (messageText.toLowerCase().includes('wordle')) {
      await handleWordleMessage(sock, from, messageText, senderName, isGroup)
    }
  })

  return sock
}

const handleWordleMessage = async (sock: any, from: string, messageText: string, senderName: string, isGroup: boolean) => {
  console.log('WORDLE - Processing message:', {
    from,
    senderName,
    isGroup,
    text: messageText.substring(0, 100)
  })

  const wordleData = parseWordleMessage(messageText)
  console.log('Parsed Wordle data:', wordleData)

  if (!wordleData) {
    console.log('No Wordle data found in message')
    return
  }

  try {
    const insertData = {
      senderName,
      gameNumber: wordleData.gameNumber,
      attempts: wordleData.attempts,
      failed: wordleData.failed,
      date: wordleData.date
    }
    console.log('Inserting data:', insertData)

    await db.insert(schema.wordleScores).values(insertData)
    console.log('Successfully saved Wordle score')

    // Optional: Send confirmation message
    // await sock.sendMessage(from, { text: `✅ Wordle ${wordleData.gameNumber} score recorded!` })

  } catch (error) {
    console.error('Error saving Wordle score:', error)
  }
}

const handleStatsCommand = async (sock: any, from: string) => {
  try {
    const [playerStats, totalStats, recentActivity] = await Promise.all([
      getPlayerStats(),
      getTotalStats(),
      getRecentActivity()
    ])

    const statsMessage = formatStatsMessage(playerStats, totalStats, recentActivity)
    await sock.sendMessage(from, { text: statsMessage })
  } catch (error) {
    console.error('Error fetching stats:', error)
    await sock.sendMessage(from, { text: 'Sorry, there was an error fetching the stats.' })
  }
}

const handleMyStatsCommand = async (sock: any, from: string, senderName: string) => {
  try {
    const playerStats = await getPlayerStats()
    const userStats = playerStats.find(p => p.senderName === senderName)

    const personalStatsMessage = formatPersonalStats(senderName, userStats || null)
    await sock.sendMessage(from, { text: personalStatsMessage })
  } catch (error) {
    console.error('Error fetching personal stats:', error)
    await sock.sendMessage(from, { text: 'Sorry, there was an error fetching your personal stats.' })
  }
}

const handleHelpCommand = async (sock: any, from: string) => {
  const helpMessage = '!stats - Overall statistics\n\n!mystats - Your personal statistics\n\n!help - This message'
  await sock.sendMessage(from, { text: helpMessage })
}

const handleIntroCommand = async (sock: any, from: string) => {
  const introMessage = '👋 Hello! I am the Wordle Tracker Bot. I can help you track your Wordle scores and provide stats for you and your friends.\n\nUse !stats to get statistics based on the results recorded in this chat. \n\nUse !mystats to get your personal statistics\n\nUse !help for a list of available commands'
  await sock.sendMessage(from, { text: introMessage })
}

const handleHintCommand = async (sock: any, from: string) => {
  const hintMessage = "💡Hint: Today's wordle answer contains 5 letters, and all 5 letters can be found in the alphabet."
  await sock.sendMessage(from, { text: hintMessage })
}

const handleFactCommand = async (sock: any, from: string) => {
  await sock.sendMessage(from, { text: getRandomFact() })
}


// Start the bot
connectToWhatsApp().catch(console.error)
