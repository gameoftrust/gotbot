import * as dotenv from 'dotenv'
import { handleMessage, handleStart } from './bot-utils'
import { TelegramBot } from './types'
import { session, Telegraf } from 'telegraf'
import { sendWelcomeText } from './utils'

dotenv.config()

if (process.env.BOT_API_TOKEN === undefined) {
  throw new TypeError('Please provide the BOT_API_TOKEN in .env file')
}

const bot: TelegramBot = new Telegraf(process.env.BOT_API_TOKEN)

bot.use(session())
bot.help(sendWelcomeText)
bot.start(handleStart)
bot.on('message', handleMessage)

bot.launch()
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
