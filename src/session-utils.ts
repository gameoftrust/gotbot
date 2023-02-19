import { Scene, SessionData, TelegramBotContext } from "../types";
import { getInitialDraftScores } from "./score";
import { killWalletConnectSession } from "./client-wallet";

export const getInitialState = (): SessionData => ({
  scene: Scene.INITIAL,
  pendingWalletAction: null,
  draftScores: getInitialDraftScores(),
  openWalletParameter: "",
  topicIdToViewEndorsements: null,
  messageIdToReply: undefined,
  userToEndorse: null,
  userToEndorseCanAccessGroupBeforeEndorsement: null,
  userToView: null,
  walletName: null,
  clientWallet: null,
  account: null,
  nicknameWarningAcknowledged: false,
});

export async function disconnectWallet(ctx: TelegramBotContext) {
  await killWalletConnectSession(ctx.session.clientWallet);
  Object.assign(ctx.session, {
    clientWallet: null,
    account: null,
  });
}

export function resetSession(ctx: TelegramBotContext) {
  const { clientWallet, walletName, account } = ctx.session;
  Object.assign(ctx.session, getInitialState(), {
    clientWallet,
    walletName,
    account,
  });
}

export async function resetSessionAndWallet(ctx: TelegramBotContext) {
  await killWalletConnectSession(ctx.session.clientWallet);
  Object.assign(ctx.session, getInitialState());
}

export function getSession(ctx: TelegramBotContext) {
  return ctx.session;
}
