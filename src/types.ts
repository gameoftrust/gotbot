import { Context as TelegrafContext, Telegraf } from 'telegraf'
import NodeWalletConnect from '@walletconnect/client'

export enum ParameterName {
  typedData = 'typedData',
}

export enum ParameterTypes {
  ADDRESS = 'address',
  UINT = 'uint',
  INT = 'int',
  STRING = 'string',
}

export enum ClientWalletType {
  MetamaskMobile = 'Metamask Mobile',
}

export interface ClientWallet {
  signTypedData: NodeWalletConnect['signTypedData']
  killSession?: NodeWalletConnect['killSession']
}

export interface SessionData {
  parameterObjects: {
    [key in ParameterName]: {
      title: string
      type: ParameterTypes
      value: string | null
    }
  }
  walletType: ClientWalletType | null
  clientWallet: ClientWallet | null
  account: string | null
}

export type CustomTelegrafContext = TelegrafContext & {
  session?: SessionData
}

export interface TelegramBotContext {
  session?: CustomTelegrafContext['session']
  message: CustomTelegrafContext['message']
  reply: (...args: Parameters<CustomTelegrafContext['reply']>) => any
  replyWithPhoto: (
    ...args: Parameters<CustomTelegrafContext['replyWithPhoto']>
  ) => any
  replyWithMarkdownV2: (
    ...args: Parameters<CustomTelegrafContext['replyWithMarkdownV2']>
  ) => any
}

export interface TelegramBotStartContext extends TelegramBotContext {
  startPayload: string
}

export type TelegramBot = Telegraf<CustomTelegrafContext>
export const clientWalletTypes = Object.values(ClientWalletType)
