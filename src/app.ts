import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { db, initializeDatabase, schema } from './db'
import { parseWordleMessage } from './utils/wordle-parser'
import { getPlayerStats, getTotalStats, getRecentActivity } from './db/queries'
import { formatStatsMessage, formatPersonalStats } from './utils/stats-formatter'
import { mkdirSync } from 'fs'
import { config } from 'dotenv'

config()

const PORT = process.env.PORT ?? 3008

const wordleFlow = addKeyword<Provider, Database>('wordle', { sensitive: false })
  .addAction(async (ctx, { flowDynamic }) => {
    const wordleData = parseWordleMessage(ctx.body)

    if (!wordleData) {
      return
    }

    try {
      await db.insert(schema.wordleScores).values({
        senderName: ctx.pushName || ctx.from,
        gameNumber: wordleData.gameNumber,
        attempts: wordleData.attempts,
        failed: wordleData.failed,
        date: wordleData.date
      })

    } catch (error) {
      console.error('Error saving Wordle score:', error)
    }
  })

const statsFlow = addKeyword<Provider, Database>('!stats', { sensitive: false })
  .addAction(async (_, { flowDynamic }) => {
    try {
      const [playerStats, totalStats, recentActivity] = await Promise.all([
        getPlayerStats(),
        getTotalStats(),
        getRecentActivity()
      ])

      const statsMessage = formatStatsMessage(playerStats, totalStats, recentActivity)
      await flowDynamic(statsMessage)
    } catch (error) {
      console.error('Error fetching stats:', error)
      await flowDynamic('Sorry, there was an error fetching the stats.')
    }
  })

const myStatsFlow = addKeyword<Provider, Database>('!mystats', { sensitive: false })
  .addAction(async (ctx, { flowDynamic }) => {
    try {
      const playerStats = await getPlayerStats()
      const senderName = ctx.pushName || ctx.from
      const userStats = playerStats.find(p => p.senderName === senderName)

      const personalStatsMessage = formatPersonalStats(senderName, userStats || null)
      await flowDynamic(personalStatsMessage)
    } catch (error) {
      console.error('Error fetching personal stats:', error)
      await flowDynamic('Sorry, there was an error fetching your personal stats.')
    }
  })

const botIntro = addKeyword<Provider, Database>('!intro', { sensitive: false })
  .addAnswer('👋 Hello! I am the Wordle Tracker Bot. I can help you track your Wordle scores and provide stats for you and your friends.\n\nUse !stats to get statistics based on the results recorded in this chat. \n\nUse !mystats to get your personal statistics\n\nUse !help for a list of available commands')

const botHelp = addKeyword<Provider, Database>('!help', { sensitive: false })
  .addAnswer('!stats - Overall statistics\n\n!mystats - Your personal statistics\n\n!help - This message')


const main = async () => {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  initializeDatabase()

  const adapterFlow = createFlow([wordleFlow, statsFlow, myStatsFlow, botIntro, botHelp])

  const adapterProvider = createProvider(Provider, {
    name: process.env.BOT_NAME || 'wordle-tracker-bot',
    usePairingCode: process.env.USE_PAIRING_CODE === 'true',
    phoneNumber: process.env.PHONE_NUMBER || null,
    browser: [
      process.env.BROWSER_NAME || 'Windows',
      process.env.BROWSER_CLIENT || 'Chrome',
      process.env.BROWSER_VERSION || 'Chrome 114.0.5735.198'
    ],
    experimentalStore: process.env.EXPERIMENTAL_STORE === 'true',
    timeRelease: parseInt(process.env.TIME_RELEASE || '21600000'),
    autoRefresh: parseInt(process.env.AUTO_REFRESH || '0'),
    writeMyself: (process.env.WRITE_MYSELF as 'none' | 'host' | 'both') || 'none',
    groupsIgnore: process.env.GROUPS_IGNORE !== 'false',
    readStatus: process.env.READ_STATUS === 'true',
    gifPlayback: process.env.GIF_PLAYBACK === 'true',
    useBaileysStore: process.env.USE_BAILEYS_STORE !== 'false',
    port: parseInt(process.env.PORT || '3008')
  })
  const adapterDB = new Database()

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  })

  adapterProvider.server.post(
    '/v1/messages',
    handleCtx(async (bot, req, res) => {
      const { number, message, urlMedia } = req.body
      await bot.sendMessage(number, message, { media: urlMedia ?? null })
      return res.end('sended')
    })
  )

  adapterProvider.server.post(
    '/v1/register',
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body
      await bot.dispatch('REGISTER_FLOW', { from: number, name })
      return res.end('trigger')
    })
  )

  adapterProvider.server.post(
    '/v1/samples',
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body
      await bot.dispatch('SAMPLES', { from: number, name })
      return res.end('trigger')
    })
  )

  adapterProvider.server.post(
    '/v1/blacklist',
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body
      if (intent === 'remove') bot.blacklist.remove(number)
      if (intent === 'add') bot.blacklist.add(number)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ status: 'ok', number, intent }))
    })
  )

  httpServer(+PORT)
}

main()
