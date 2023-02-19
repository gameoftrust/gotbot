import NodeWalletConnect from '@walletconnect/client'
import { ClientWallet, ClientWalletType, TelegramBotContext } from './types'
import qr from 'qrcode'
import { Markup } from 'telegraf'
import { getSession } from './session-utils'

export const clientWalletDeepLinks = {
  [ClientWalletType.MetamaskMobile]: 'https://metamask.app.link/',
}

export async function initializeClientWallet(
  ctx: TelegramBotContext,
  walletType: ClientWalletType,
  onConnect: (account: string) => void
): Promise<ClientWallet> {
  const clientWallet = new NodeWalletConnect({
    bridge: 'https://bridge.walletconnect.org', // Required
    clientMeta: {
      description: 'Game of Trust',
      url: 'https://gameoftrust.com/',
      icons: ['https://nodejs.org/static/images/logo.svg'],
      name: 'GameOfTrust',
    },
  })
  await clientWallet.createSession()
  clientWallet.on('connect', async (error, payload) =>
    onConnect(payload.params[0].accounts[0])
  )
  const uri = clientWallet.uri

  const deeplinkUri =
    clientWalletDeepLinks[walletType] + 'wc?uri=' + encodeURIComponent(uri)

  const qrBase64Url = await qr.toDataURL(uri)
  const qrBuffer = Buffer.from(qrBase64Url.substring(22), 'base64')
  await ctx.replyWithPhoto(
    { source: qrBuffer },
    {
      caption: `Scan this QR Code with your ${walletType} app.\n Or click the bellow button to open ${walletType}`,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.url(`Open ${walletType}`, deeplinkUri),
      ]),
    }
  )
  return clientWallet
}

export async function signTypedDataWithClientWallet(
  ctx: TelegramBotContext,
  typedData: string
) {
  const session = getSession(ctx)

  const { clientWallet, walletType, account } = session
  if (!clientWallet || !walletType || !account)
    throw new Error('wallet is not connected')

  const msgParams = [
    account, // Required
    typedData, // Required
  ]
  const promise = clientWallet.signTypedData(msgParams)

  ctx.reply('Confirm signature in your wallet', {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.url('Open wallet', clientWalletDeepLinks[walletType]),
    ]),
  })

  return promise
}
