import {
  ClientWalletType,
  clientWalletTypes,
  ParameterName,
  TelegramBotContext,
  TelegramBotStartContext,
} from './types'
import {
  chooseWallet,
  handleParametersAndSetValueIfAvailable,
  isValidParamValue,
  resetStateAndSendChooseWalletMessage,
  sendWelcomeText,
  setParamValue,
  setupWallet,
} from './utils'
import { getInitialState, resetSession } from './session-utils'

export async function handleStart(ctx: TelegramBotStartContext) {
  resetSession(ctx)
  ctx.startPayload.split('-').forEach((param) => {
    const [paramNameStr, value] = param.split('=')
    const paramName = paramNameStr as ParameterName
    if (isValidParamValue(ctx, paramName, value)) {
      setParamValue(ctx, paramName, value)
    }
  })
  return sendWelcomeText(ctx)
}

export async function handleMessage(ctx: TelegramBotContext) {
  ctx.session = ctx.session ?? getInitialState()

  // @ts-ignore
  const text: string = ctx.message.text

  if (text === '/reset') {
    return await resetStateAndSendChooseWalletMessage(ctx)
  }

  if (!ctx.session.walletType) {
    const walletType = text as ClientWalletType
    if (clientWalletTypes.includes(walletType)) {
      return await setupWallet(ctx, walletType)
    } else {
      return await chooseWallet(ctx)
    }
  } else if (!ctx.session.account) {
    return await ctx.reply('Please connect your wallet first')
  } else {
    return await handleParametersAndSetValueIfAvailable(ctx, text)
  }
}
