import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup,
  jidNormalizedUser,
  Browsers
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import express from 'express'
import { config } from 'dotenv'
import { db, initializeDatabase, schema } from './db'
import { parseWordleMessage } from './utils/wordle-parser'
import { getPlayerStats, getTotalStats, getRecentActivity } from './db/queries'
import { formatStatsMessage, formatPersonalStats } from './utils/stats-formatter'
import { getRandomFact } from './utils/random-fact'

config()

// Environment detection
const isProduction = process.env.NODE_ENV === 'production'
const isLocalDevelopment = !isProduction && process.env.LOCAL_DEV === 'true'
const isDockerContainer = process.env.DOCKER_CONTAINER === 'true'

console.log('Environment check:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
  BOT_NAME: process.env.BOT_NAME || 'wordle-tracker-bot',
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction,
  isLocalDevelopment,
  isDockerContainer,
  platform: process.platform
})

let isConnecting = false
let reconnectAttempts = 0
let sock: any = null
const MAX_RECONNECT_ATTEMPTS = 3

// Web server for QR code display
let currentQRCode: string | null = null
let connectionStatus = 'disconnected' // disconnected, connecting, qr_ready, connected
let qrTimeout: NodeJS.Timeout | null = null
let qrGenerationCount = 0
let lastQRTime = 0
const app = express()
const WEB_PORT = process.env.WEB_PORT || 3001
const QR_TIMEOUT_MS = 45000 // 45 seconds timeout for QR code (shorter for production)
const MAX_QR_ATTEMPTS = 10 // Maximum QR generation attempts

app.get('/', (req, res) => {
  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected':
        return { message: '✅ Connected to WhatsApp!', color: '#28a745', refresh: 30 }
      case 'connecting':
        return { message: '🔄 Connecting to WhatsApp...', color: '#007bff', refresh: 5 }
      case 'qr_ready':
        return { message: '📱 Scan QR code with WhatsApp', color: '#007bff', refresh: 10 }
      default:
        return { message: '⏳ Initializing...', color: '#666', refresh: 5 }
    }
  }

  const status = getStatusMessage()

  if (!currentQRCode || connectionStatus === 'connected') {
    res.send(`
      <html>
        <head>
          <title>WhatsApp Bot - Status</title>
          <meta http-equiv="refresh" content="${status.refresh}">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .status { font-size: 18px; margin: 20px 0; color: ${status.color}; }
            .info { color: #666; margin: 10px 0; }
            .refresh-btn { 
              background: #007bff; color: white; border: none; 
              padding: 10px 20px; border-radius: 5px; cursor: pointer; 
              margin: 20px 10px; font-size: 16px;
            }
            .refresh-btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>WhatsApp Bot</h1>
          <div class="status">${status.message}</div>
          ${connectionStatus === 'connected' ?
        '<div class="info">Bot is ready to receive messages!</div>' :
        '<div class="info">Waiting for QR code...</div>'
      }
          <button class="refresh-btn" onclick="location.reload()">Refresh</button>
          <div class="info">Page refreshes automatically every ${status.refresh} seconds</div>
        </body>
      </html>
    `)
  } else {
    res.send(`
      <html>
        <head>
          <title>WhatsApp Bot - QR Code</title>
          <meta http-equiv="refresh" content="10">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .qr-container { margin: 20px 0; }
            .instructions { font-size: 16px; margin: 20px 0; color: #333; }
            .status { font-size: 18px; margin: 20px 0; color: #007bff; }
            .warning { color: #ff6b35; font-size: 14px; margin: 10px 0; }
            .refresh-btn { 
              background: #007bff; color: white; border: none; 
              padding: 10px 20px; border-radius: 5px; cursor: pointer; 
              margin: 20px 10px; font-size: 16px;
            }
            .refresh-btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>WhatsApp Bot - QR Code</h1>
          <div class="status">📱 Scan QR code with WhatsApp</div>
          <div class="qr-container">
            <img src="data:image/png;base64,${currentQRCode}" alt="QR Code" style="max-width: 300px;">
          </div>
          <div class="instructions">
            1. Open WhatsApp on your phone<br>
            2. Go to Settings → Linked Devices<br>
            3. Tap "Link a Device"<br>
            4. Scan this QR code
          </div>
          <div class="warning">QR code expires in 45 seconds</div>
          <button class="refresh-btn" onclick="location.reload()">Refresh</button>
          <div class="info">Attempt ${qrGenerationCount}/${MAX_QR_ATTEMPTS}</div>
        </body>
      </html>
    `)
  }
})

// Status API endpoint
app.get('/status', (req, res) => {
  res.json({
    connected: connectionStatus === 'connected',
    hasQR: !!currentQRCode,
    user: sock?.user || null,
    status: connectionStatus,
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    uptime: process.uptime()
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Manual QR refresh endpoint for production troubleshooting
app.post('/refresh-qr', (req, res) => {
  console.log('🔄 Manual QR refresh requested')

  if (connectionStatus === 'connected') {
    res.json({
      success: false,
      message: 'Already connected to WhatsApp',
      status: connectionStatus
    })
    return
  }

  // Clear current QR and force reconnection
  currentQRCode = null
  connectionStatus = 'connecting'
  qrGenerationCount = Math.max(0, qrGenerationCount - 2) // Give it more attempts

  if (qrTimeout) {
    clearTimeout(qrTimeout)
    qrTimeout = null
  }

  if (sock) {
    try {
      sock.end()
    } catch (e) { }
  }

  // Force reconnection
  setTimeout(() => {
    console.log('🔄 Forcing reconnection after manual refresh')
    connectToWhatsApp()
  }, 1000)

  res.json({
    success: true,
    message: 'QR refresh initiated',
    qrAttempt: qrGenerationCount + 1
  })
})

// Start web server BEFORE WhatsApp connection
app.listen(WEB_PORT, () => {
  console.log(`🌐 Web server running at http://localhost:${WEB_PORT}`)
  console.log(`📱 Open this URL to view the QR code: http://localhost:${WEB_PORT}`)

  // Start WhatsApp connection after web server is ready
  console.log('🚀 Starting Wordle Tracker Bot...')
  connectToWhatsApp().catch((error) => {
    console.error('❌ Failed to start bot:', error)
    process.exit(1)
  })
})

const connectToWhatsApp = async () => {
  if (isConnecting) {
    console.log('Already connecting, skipping...')
    return
  }

  if (qrGenerationCount >= MAX_QR_ATTEMPTS) {
    console.log(`❌ Maximum QR generation attempts (${MAX_QR_ATTEMPTS}) reached. Stopping.`)
    console.log('💡 Try clearing the session directory and restarting')
    process.exit(1)
  }

  isConnecting = true
  connectionStatus = 'connecting'

  try {
    // Initialize database
    await initializeDatabase()

    // Use multi-file auth state for session management
    const { state, saveCreds } = await useMultiFileAuthState('wordle-tracker-bot_sessions')

    // Close existing connection if any
    if (sock) {
      try {
        sock.end()
      } catch (e) { }
    }

    // Environment-specific configuration
    let browserConfig
    let qrTimeoutMs
    let shouldPrintQR

    if (isProduction) {
      // Production server configuration
      browserConfig = Browsers.ubuntu('Wordle Tracker Bot')
      qrTimeoutMs = 60000
      shouldPrintQR = false
      console.log('🏭 Using production configuration (Ubuntu browser)')
    } else if (isDockerContainer) {
      // Local development in Docker - use Chrome to avoid WhatsApp restrictions
      browserConfig = ['Chrome (Linux)', 'Wordle Tracker Bot', '22.04.4']
      qrTimeoutMs = 90000 // Longer timeout for local development
      shouldPrintQR = true
      console.log('🐳 Using Docker development configuration (Chrome browser)')
    } else {
      // Native local development
      browserConfig = Browsers.macOS('Wordle Tracker Bot')
      qrTimeoutMs = 90000
      shouldPrintQR = true
      console.log('💻 Using native development configuration (macOS browser)')
    }

    sock = makeWASocket({
      auth: state,
      browser: browserConfig,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      retryRequestDelayMs: isProduction ? 250 : 500,
      maxMsgRetryCount: isProduction ? 5 : 3,
      shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: () => false,
      printQRInTerminal: shouldPrintQR,
      qrTimeout: qrTimeoutMs
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        qrGenerationCount++
        lastQRTime = Date.now()

        console.log(`\n🔗 QR code generated (#${qrGenerationCount}) - view at http://localhost:${WEB_PORT}`)
        console.log(`📊 QR Generation Stats: Attempt ${qrGenerationCount}/${MAX_QR_ATTEMPTS}`)

        // Only show terminal QR in development
        if (process.env.NODE_ENV !== 'production') {
          qrcode.generate(qr, { small: true })
        }

        connectionStatus = 'qr_ready'

        // Clear any existing timeout
        if (qrTimeout) {
          clearTimeout(qrTimeout)
        }

        // Generate base64 QR code for web display with production optimizations
        try {
          currentQRCode = await QRCode.toDataURL(qr, {
            type: 'image/png',
            width: 256, // Smaller for faster loading
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M' // Medium error correction
          })
          currentQRCode = currentQRCode.replace('data:image/png;base64,', '')

          console.log('✅ QR code generated successfully for web display')

          // Set timeout for QR code with exponential backoff
          const timeoutDelay = Math.min(QR_TIMEOUT_MS * Math.pow(1.2, qrGenerationCount - 1), 120000)

          qrTimeout = setTimeout(() => {
            console.log(`⏰ QR code timeout after ${QR_TIMEOUT_MS / 1000}s (attempt ${qrGenerationCount})`)
            if (sock) {
              try {
                sock.end()
              } catch (e) { }
            }
          }, timeoutDelay)

        } catch (error) {
          console.error('❌ Error generating QR code for web display:', error)
        }
      }

      if (connection === 'open') {
        console.log('✅ Connected to WhatsApp!')
        connectionStatus = 'connected'
        currentQRCode = null
        qrGenerationCount = 0 // Reset counter on successful connection
        reconnectAttempts = 0
        isConnecting = false

        if (qrTimeout) {
          clearTimeout(qrTimeout)
          qrTimeout = null
        }
      }

      if (connection === 'close') {
        isConnecting = false
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const reason = lastDisconnect?.error?.message

        console.log('Connection closed:', {
          reason: reason || 'undefined',
          statusCode: statusCode || 'undefined',
          shouldReconnect,
          attempts: reconnectAttempts,
        })

        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)

          // Exponential backoff for reconnection
          const delay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 30000)
          console.log(`🔄 Reconnecting in ${delay / 1000}s...`)

          setTimeout(() => {
            connectToWhatsApp()
          }, delay)
        } else if (!shouldReconnect) {
          console.log('❌ Logged out or permanent error, not reconnecting')
          console.log('💡 Please restart the bot to generate a new QR code')
          process.exit(1)
        } else {
          console.log('❌ Max reconnection attempts reached')
          console.log('💡 Please restart the bot')
          process.exit(1)
        }
      }
    })

    sock.ev.on('creds.update', saveCreds)

    // Enhanced message handling with better filtering
    sock.ev.on('messages.upsert', async (m) => {
      console.log('📨 Received messages:', m.messages.length)

      try {
        for (const message of m.messages) {
          // Skip if no message content
          if (!message.message) {
            console.log('❌ Skipping message with no content')
            continue
          }

          // Enhanced filtering for bot messages
          if (message.key.fromMe) {
            const messageText = message.message.conversation ||
              message.message.extendedTextMessage?.text ||
              message.message.imageMessage?.caption ||
              message.message.videoMessage?.caption || ''

            // Skip if it's a bot response (starts with emoji or common bot phrases)
            if (messageText.startsWith('✅') ||
              messageText.startsWith('📊') ||
              messageText.startsWith('🤖') ||
              messageText.startsWith('❌') ||
              messageText.includes('Wordle Tracker Bot Commands') ||
              messageText.includes('Overall statistics') ||
              messageText.includes('Sorry, there was an error')) {
              console.log('❌ Skipping bot response message')
              continue
            }

            console.log('✅ Processing message from host')
          }

          const messageText = message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            message.message.imageMessage?.caption ||
            message.message.videoMessage?.caption || ''

          console.log('📝 Extracted text:', messageText)

          if (!messageText) {
            console.log('❌ No text content found, skipping')
            continue
          }

          const from = message.key.remoteJid!
          const isGroup = isJidGroup(from)
          const senderJid = isGroup ? message.key.participant! : from
          const senderName = message.pushName || jidNormalizedUser(senderJid)

          console.log('📨 Message received:', {
            from: isGroup ? 'Group' : 'Individual',
            sender: senderName,
            text: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
            isGroup,
            fullFrom: from
          })

          // Handle commands
          if (messageText.toLowerCase().includes('!stats')) {
            console.log('🎯 Handling !stats command')
            await handleStatsCommand(sock, from)
            continue
          }

          if (messageText.toLowerCase().includes('!mystats')) {
            console.log('🎯 Handling !mystats command')
            await handleMyStatsCommand(sock, from, senderName)
            continue
          }

          if (messageText.toLowerCase().includes('!help')) {
            console.log('🎯 Handling !help command')
            await handleHelpCommand(sock, from)
            continue
          }

          if (messageText.toLowerCase().includes('!intro')) {
            console.log('🎯 Handling !intro command')
            await handleIntroCommand(sock, from)
            continue
          }

          if (messageText.toLowerCase().includes('!hint')) {
            console.log('🎯 Handling !intro command')
            await handleHintCommand(sock, from)
            continue
          }

          if (messageText.toLowerCase().includes('!fact')) {
            console.log('🎯 Handling !intro command')
            await handleFactCommand(sock, from)
            continue
          }

          // Handle Wordle messages
          if (messageText.toLowerCase().includes('wordle')) {
            console.log('🎯 Handling Wordle message')
            await handleWordleMessage(sock, from, messageText, senderName, isGroup)
          } else {
            console.log('ℹ️ Message does not contain commands or "wordle"')
          }

        }
      } catch (error) {
        console.error('❌ Error processing message:', error)
      }
    })

    // Add more event listeners for debugging
    sock.ev.on('messages.update', (updates) => {
      console.log('🔄 messages.update:', updates.length, 'updates')
    })

    sock.ev.on('message-receipt.update', (updates) => {
      console.log('📬 message-receipt.update:', updates.length, 'receipts')
    })

    sock.ev.on('presence.update', (update) => {
      console.log('👤 presence.update:', update.id, update.presences ? Object.keys(update.presences) : 'none')
    })

    sock.ev.on('chats.upsert', (chats) => {
      console.log('💬 chats.upsert:', chats.length, 'chats')
    })

    sock.ev.on('contacts.upsert', (contacts) => {
      console.log('👥 contacts.upsert:', contacts.length, 'contacts')
    })

    return sock
  } catch (error) {
    console.error('Error connecting to WhatsApp:', error)
    isConnecting = false
    throw error
  }
}

const handleHintCommand = async (sock: any, from: string) => {
  const hintMessage = `💡 Wordle Hint: Today's word contains 5 letters, all of which can be found in the alphabet.`
  await sock.sendMessage(from, { text: hintMessage })
}

const handleFactCommand = async (sock: any, from: string) => {
  await sock.sendMessage(from, { text: getRandomFact() })
}

const handleWordleMessage = async (sock: any, from: string, messageText: string, senderName: string, isGroup: boolean) => {
  console.log('🎯 Processing Wordle message:', {
    sender: senderName,
    isGroup,
    preview: messageText.substring(0, 100) + '...'
  })

  const wordleData = parseWordleMessage(messageText)

  if (!wordleData) {
    console.log('❌ No valid Wordle data found')
    return
  }

  console.log('✅ Parsed Wordle data:', wordleData)

  try {
    const insertData = {
      senderName,
      gameNumber: wordleData.gameNumber,
      attempts: wordleData.attempts,
      failed: wordleData.failed,
      date: wordleData.date
    }

    await db.insert(schema.wordleScores).values(insertData)
    console.log('💾 Successfully saved Wordle score to database')

    // Send confirmation (optional)
    const confirmationMsg = `✅ Wordle ${wordleData.gameNumber} score recorded for ${senderName}!`
    await sock.sendMessage(from, { text: confirmationMsg })

  } catch (error) {
    console.error('❌ Error saving Wordle score:', error)
  }
}

const handleStatsCommand = async (sock: any, from: string) => {
  try {
    console.log('📊 Fetching stats...')
    const [playerStats, totalStats, recentActivity] = await Promise.all([
      getPlayerStats(),
      getTotalStats(),
      getRecentActivity()
    ])

    const statsMessage = formatStatsMessage(playerStats, totalStats, recentActivity)
    await sock.sendMessage(from, { text: statsMessage })
    console.log('📊 Stats sent successfully')
  } catch (error) {
    console.error('❌ Error fetching stats:', error)
    await sock.sendMessage(from, { text: 'Sorry, there was an error fetching the stats.' })
  }
}

const handleMyStatsCommand = async (sock: any, from: string, senderName: string) => {
  try {
    console.log(`📊 Fetching personal stats for ${senderName}...`)
    const playerStats = await getPlayerStats()
    const userStats = playerStats.find(p => p.senderName === senderName)

    const personalStatsMessage = formatPersonalStats(senderName, userStats || null)
    await sock.sendMessage(from, { text: personalStatsMessage })
    console.log('📊 Personal stats sent successfully')
  } catch (error) {
    console.error('❌ Error fetching personal stats:', error)
    await sock.sendMessage(from, { text: 'Sorry, there was an error fetching your personal stats.' })
  }
}

const handleHelpCommand = async (sock: any, from: string) => {
  const helpMessage = `🤖 Wordle Tracker Bot Commands:

!stats - Overall statistics
!mystats - Your personal statistics  
!help - This message
!intro - Bot introduction

Just share your Wordle results and I'll track them automatically!`

  await sock.sendMessage(from, { text: helpMessage })
  console.log('ℹ️ Help message sent')
}

const handleIntroCommand = async (sock: any, from: string) => {
  const introMessage = `👋 Hello! I am the Wordle Tracker Bot. 

I can help you track your Wordle scores and provide stats for you and your friends.

📊 Use !stats to get overall statistics
📈 Use !mystats to get your personal statistics  
❓ Use !help for available commands

Just share your Wordle results in this chat and I'll automatically track them!`

  await sock.sendMessage(from, { text: introMessage })
  console.log('👋 Intro message sent')
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot...')
  process.exit(0)
})

// Bot startup is now handled in the web server callback above
