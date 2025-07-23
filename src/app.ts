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

config()

console.log('Environment check:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
  BOT_NAME: process.env.BOT_NAME || 'wordle-tracker-bot'
})

let isConnecting = false
let reconnectAttempts = 0
let sock: any = null
const MAX_RECONNECT_ATTEMPTS = 3

// Web server for QR code display
let currentQRCode: string | null = null
const app = express()
const WEB_PORT = process.env.WEB_PORT || 3000

app.get('/', (req, res) => {
  if (!currentQRCode) {
    res.send(`
      <html>
        <head>
          <title>WhatsApp Bot - QR Code</title>
          <meta http-equiv="refresh" content="5">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .status { font-size: 18px; margin: 20px 0; }
            .waiting { color: #666; }
            .connected { color: #28a745; }
          </style>
        </head>
        <body>
          <h1>WhatsApp Bot</h1>
          <div class="status waiting">Waiting for QR code...</div>
          <p>The page will refresh automatically when a QR code is available.</p>
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
          </style>
        </head>
        <body>
          <h1>WhatsApp Bot - Scan QR Code</h1>
          <div class="status">Scan this QR code with WhatsApp</div>
          <div class="qr-container">
            <img src="data:image/png;base64,${currentQRCode}" alt="QR Code" style="max-width: 300px; max-height: 300px;" />
          </div>
          <div class="instructions">
            <p>1. Open WhatsApp on your phone</p>
            <p>2. Go to Settings → Linked Devices</p>
            <p>3. Tap "Link a Device"</p>
            <p>4. Scan this QR code</p>
          </div>
          <p><em>This page will refresh automatically. Once connected, you can close this page.</em></p>
        </body>
      </html>
    `)
  }
})

app.get('/status', (req, res) => {
  res.json({
    connected: sock?.user ? true : false,
    hasQR: !!currentQRCode,
    user: sock?.user || null
  })
})

// Start web server
app.listen(WEB_PORT, () => {
  console.log(`🌐 Web server running at http://localhost:${WEB_PORT}`)
  console.log(`📱 Open this URL to view the QR code: http://localhost:${WEB_PORT}`)
})

const connectToWhatsApp = async () => {
  if (isConnecting) {
    console.log('Already connecting, skipping...')
    return
  }
  
  isConnecting = true
  
  try {
    // Initialize database
    await initializeDatabase()

    // Use multi-file auth state for session management
    const { state, saveCreds } = await useMultiFileAuthState('wordle-tracker-bot_sessions')

    // Close existing connection if any
    if (sock) {
      try {
        sock.end()
      } catch (e) {}
    }

    sock = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Wordle Tracker Bot'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update
      
      if (qr) {
        console.log('\n🔗 QR code generated - view at http://localhost:' + WEB_PORT)
        qrcode.generate(qr, { small: true })
        
        // Generate base64 QR code for web display
        try {
          currentQRCode = await QRCode.toDataURL(qr, {
            type: 'image/png',
            width: 300,
            margin: 2
          })
          currentQRCode = currentQRCode.replace('data:image/png;base64,', '')
        } catch (error) {
          console.error('Error generating QR code for web:', error)
        }
      }
      
      if (connection === 'close') {
        isConnecting = false
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut
        
        console.log('Connection closed:', {
          reason: lastDisconnect?.error?.message,
          statusCode,
          shouldReconnect,
          attempts: reconnectAttempts
        })
        
        // Handle conflict error specifically
        if (statusCode === 440) { // Conflict error
          console.log('❌ Conflict detected - another WhatsApp Web session is active')
          console.log('Please:')
          console.log('1. Close WhatsApp Web in your browser')
          console.log('2. Logout from other WhatsApp Web sessions')
          console.log('3. Restart this bot')
          process.exit(1)
        }
        
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
          setTimeout(() => connectToWhatsApp(), 5000)
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('Max reconnection attempts reached. Please restart the bot.')
          process.exit(1)
        }
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp!')
        console.log('🤖 Bot is ready to receive messages')
        currentQRCode = null // Clear QR code when connected
        isConnecting = false
        reconnectAttempts = 0
      }
    })

    sock.ev.on('creds.update', saveCreds)

    // Add more event listeners for debugging
    sock.ev.on('messages.upsert', async (m) => {
      console.log('🔔 RAW messages.upsert event:', {
        messageCount: m.messages.length,
        type: m.type,
        messages: m.messages.map(msg => ({
          key: msg.key,
          hasMessage: !!msg.message,
          fromMe: msg.key.fromMe,
          messageKeys: msg.message ? Object.keys(msg.message) : []
        }))
      })

      try {
        for (const message of m.messages) {
          console.log('🔍 Processing message:', {
            key: message.key,
            hasMessage: !!message.message,
            fromMe: message.key.fromMe,
            messageType: message.message ? Object.keys(message.message)[0] : 'none'
          })

          if (!message.message) {
            console.log('❌ No message content, skipping')
            continue
          }
          
          // Allow messages from host, but skip bot's own command responses
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

// Start the bot
console.log('🚀 Starting Wordle Tracker Bot...')
connectToWhatsApp().catch((error) => {
  console.error('❌ Failed to start bot:', error)
  process.exit(1)
})