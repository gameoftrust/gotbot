import {
  ClientWallet,
  ClientWalletType,
  TelegramBotContext,
} from '../src/types'
import { handleMessage } from '../src/bot-utils'
import * as ClientWalletModule from '../src/client-wallet'
import { getInitialState } from '../src/session-utils'
import { i18n } from '../src/i18n'

function getBasicContext(text: string): TelegramBotContext {
  return {
    message: {
      message_id: 10,
      date: Date.now(),
      text,
      chat: { type: 'private', id: 1, first_name: 'first name' },
      from: { id: 1, is_bot: false, first_name: 'first name' },
    },
    session: getInitialState(),
    reply: jest.fn(),
    replyWithPhoto: jest.fn(),
    replyWithMarkdownV2: jest.fn(),
  }
}

function setTextOnContext(ctx: TelegramBotContext, text: string) {
  if (ctx.message) {
    ctx.message = {
      ...ctx.message,
      message_id: ctx.message.message_id + 1,
      text,
    }
  }
  return ctx
}

const account = '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826'
const typedData = JSON.stringify({
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      {
        name: 'version',
        type: 'string',
      },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
    to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
    contents: 'Hello, Bob!',
  },
})
const signature =
  '0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915621c'

function getClientWallet(): ClientWallet {
  return {
    signTypedData: jest.fn(),
  }
}

function mockClientWalletInitialization() {
  return jest
    .spyOn(ClientWalletModule, 'initializeClientWallet')
    .mockImplementation(async (_ctx, _walletType, onConnect) => {
      onConnect(account)
      return getClientWallet()
    })
}

function mockClientWalletSign() {
  return jest
    .spyOn(ClientWalletModule, 'signTypedDataWithClientWallet')
    .mockReturnValueOnce(Promise.resolve(signature))
}

describe('bot', () => {
  it('signs typed data', async () => {
    let ctx = getBasicContext('hi')
    await handleMessage(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      i18n.__('choose_wallet'),
      expect.anything()
    )

    const initSpy = mockClientWalletInitialization()
    ctx = setTextOnContext(ctx, ClientWalletType.MetamaskMobile)
    ctx.reply = jest.fn()
    await handleMessage(ctx)
    expect(ctx.reply).toHaveBeenNthCalledWith(1, 'Wallet Connected!')
    expect(initSpy).toHaveBeenCalled()

    const signSpy = mockClientWalletSign()
    ctx = setTextOnContext(ctx, typedData)
    ctx.reply = jest.fn()
    await handleMessage(ctx)
    expect(ctx.replyWithMarkdownV2).toHaveBeenNthCalledWith(
      1,
      '```' + signature + '```'
    )
    expect(signSpy).toHaveBeenCalled()
  })
})
