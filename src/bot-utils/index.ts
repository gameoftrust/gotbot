import {
  ParameterKey,
  ReplyKeyboardMarkup,
  Scene,
  SEND_MESSAGE_SCENES,
  SET_NICKNAME_SCENES,
  TelegramBotContext,
  VPN_SCENES,
} from "../../types";
import {
  chooseWallet,
  resetStateAndSendChooseWalletMessage,
  setupWallet,
} from "./walletFlow";
import { getSession, resetSession } from "../session-utils";
import i18next from "i18next";
import { store } from "../store";
import {
  getViewProfileLink,
  handleEndorsementFlow,
  setUserToEndorse,
} from "./endorsementFlow";
import { findPerfectEndorsementPath } from "../web-of-trust";
import {
  clientWalletTypes,
  sendConfirmSignatureMessage,
} from "../client-wallet";
import { Markup } from "telegraf";
import { handleViewUserFlow } from "./viewUserFlow";
import { getMessageScene, handleSendMessageFlow } from "./sendMessageFlow";
import { DEBUG, GOT_DEFAULT_CHAT_ID } from "../constants";
import { handleSetNicknameFlow } from "./nicknameFlow";
import { addressToRepresentation } from "../web3";
import { handleVPNFlow } from "./VPNFlow";
import { getChatTypeTranslationArg } from "../i18n";
import { getChatInvitationLinkForCurrentUser } from "./gotSpaceManagement";

export function addressRepresentationWithLink(
  ctx: TelegramBotContext,
  address: string,
  returnYouIfUsersAddress = true
) {
  const { account } = getSession(ctx);
  if (
    returnYouIfUsersAddress &&
    account?.toLowerCase() === address.toLowerCase()
  ) {
    return i18next.t("you");
  }
  return `[${addressToRepresentation(address)}](${getViewProfileLink(
    ctx,
    address
  )})`;
}

export function getBotInfo(ctx: TelegramBotContext) {
  return ctx.botInfo;
}

export function getTelegramApi(ctx: TelegramBotContext) {
  return ctx.telegram;
}

// the following two functions are created to make switching between grammyjs and telegraf easier
export function createKeyboard(keys: string[][]): ReplyKeyboardMarkup {
  return Markup.keyboard(keys).oneTime().resize();
}

export function replyMarkupArguments<T>(keyboard: T): T {
  return keyboard;
}

function sendBotNotLoadedMessage(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("botNotLoadedYet"));
}

export function findMainTopicEndorsementPath(
  fromAccount: string,
  toAccount: string
) {
  const {
    reputationGraph: {
      metadata: { mainTopicId },
    },
  } = store.getState();
  return findPerfectEndorsementPath(
    fromAccount,
    toAccount,
    String(mainTopicId)
  );
}

export function canAccessGroup(account: string) {
  const startAccount = process.env.WOT_START_ACCOUNT;
  if (!startAccount) throw new Error("WOT_START_ACCOUNT not provided");
  const endorsementPath = findMainTopicEndorsementPath(
    startAccount.toLowerCase(),
    account.toLowerCase()
  );
  return endorsementPath !== null;
}

export function canAccessBot(account: string) {
  return canAccessGroup(account);
}

export async function sendUserProfileLink(ctx: TelegramBotContext) {
  const { account } = getSession(ctx);
  if (!account) throw new Error("account not provided");
  return ctx.reply(
    i18next.t("profileLinkMessage", {
      endorsementLink: getViewProfileLink(ctx, account),
    }),
    {
      ...replyMarkupArguments(createKeyboard([[i18next.t("checkAgain")]])),
      parse_mode: "Markdown",
    }
  );
}

export function getMainMenuKeyboard() {
  return createKeyboard([
    [i18next.t("sendMessage.sendMessageInChat", getChatTypeTranslationArg())],
    [i18next.t("sendMessage.sendReplyOrComment")],
    [i18next.t("getChatInvitationLink", getChatTypeTranslationArg()), "VPN"],
    [i18next.t("nickname.setNickname"), i18next.t("getProfileLink")],
  ]);
}

export function sendMainMenuMessage(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("mainMenu"), {
    ...replyMarkupArguments(getMainMenuKeyboard()),
  });
}

export async function handleConnectedUserState(
  ctx: TelegramBotContext,
  message: string | null = null
): Promise<any> {
  const session = getSession(ctx);

  if (session.pendingWalletAction && message !== i18next.t("cancel")) {
    return sendConfirmSignatureMessage(ctx);
  }

  const { account, userToEndorse, userToView, walletName, scene } = session;
  if (!account) throw new Error("account not provided");
  if (!walletName) throw new Error("walletName not provided");

  if (!canAccessBot(account)) {
    if (message === i18next.t("checkAgain")) {
      await ctx.reply(i18next.t("notEndorsedYet"));
    }
    return sendUserProfileLink(ctx);
    // await sendUserProfileLink(ctx);
    // return ctx.reply(i18next.t("sendCheckAgainAfterYouGotEndorsed"), {
    //   ...replyMarkupArguments(createKeyboard([[i18next.t("checkAgain")]])),
    //   parse_mode: "Markdown",
    // });
  }

  if (message?.startsWith("/vnum") && process.env.VIRTUAL_NUMBER_MESSAGE) {
    await ctx.reply(process.env.VIRTUAL_NUMBER_MESSAGE);
  }

  if (userToEndorse) {
    return handleEndorsementFlow(ctx, message);
  }

  if (userToView) {
    return handleViewUserFlow(ctx, message);
  }

  if (
    SEND_MESSAGE_SCENES.includes(scene) ||
    (scene === Scene.INITIAL &&
      (message ===
        i18next.t(
          "sendMessage.sendMessageInChat",
          getChatTypeTranslationArg()
        ) ||
        message === i18next.t("sendMessage.sendReplyOrComment")))
  ) {
    return handleSendMessageFlow(ctx, message);
  }

  if (
    SET_NICKNAME_SCENES.includes(scene) ||
    (scene === Scene.INITIAL && message === i18next.t("nickname.setNickname"))
  ) {
    return handleSetNicknameFlow(ctx, message);
  }

  if (
    VPN_SCENES.includes(scene) ||
    (scene === Scene.INITIAL && message === "VPN")
  ) {
    return handleVPNFlow(ctx, message);
  }

  if (scene === Scene.INITIAL) {
    if (
      message ===
      i18next.t("getChatInvitationLink", getChatTypeTranslationArg())
    ) {
      if (canAccessGroup(account)) {
        try {
          const inviteLink = await getChatInvitationLinkForCurrentUser(
            ctx,
            Number(GOT_DEFAULT_CHAT_ID)
          );
          await ctx.reply(
            i18next.t("inviteToChat", {
              inviteLink,
              ...getChatTypeTranslationArg(),
            })
          );
          return sendMainMenuMessage(ctx);
        } catch (e) {
          return ctx.reply(String(e));
        }
      } else {
        return sendUserProfileLink(ctx);
      }
    }

    if (message === i18next.t("getProfileLink")) {
      await sendUserProfileLink(ctx);
    }

    return sendMainMenuMessage(ctx);
  }
}

export async function handlePrivateTextMessage(ctx: TelegramBotContext) {
  // @ts-ignore
  let text: string | null = ctx.message?.text || ctx.match?.[0] || null;
  if (!text) {
    if (
      ctx.message &&
      "new_chat_members" in ctx.message &&
      ctx.message.new_chat_members.find((u) => u.id === getBotInfo(ctx).id)
    ) {
      text = "/start";
    } else {
      return;
    }
  }
  const botStartLinkParams = text.split(
    `https://t.me/${getBotInfo(ctx).username}?start=`
  )[1];
  if (botStartLinkParams) {
    text = "/start " + botStartLinkParams;
  }

  if (DEBUG) {
    console.log(new Date().getTime() + " " + ctx.chat?.id + ":" + text);
  }

  if (text.startsWith("/start")) {
    const query = text.split(" ")[1];
    if (query) {
      const params = query.split("-");
      for (const param of params) {
        const [key, value] = param.split("=");
        if (key === ParameterKey.ENDORSE) {
          resetSession(ctx);
          setUserToEndorse(ctx, value);
        }
        if (key === ParameterKey.VIEW_USER) {
          resetSession(ctx);
          ctx.session.userToView = value;
        }
        if (key === ParameterKey.REPLY) {
          resetSession(ctx);
          ctx.session.scene = Scene.SEND_MESSAGE_TO_GROUP_GET_MESSAGE;
          ctx.session.messageIdToReply = Number(value);
          return getMessageScene(ctx);
        }
      }
    }
  }

  const { account } = ctx.session;
  if (text.startsWith("/start")) {
    if (!account) {
      await ctx.reply(i18next.t("welcome"));
    }
  }

  if (text.startsWith("/reset")) {
    return resetStateAndSendChooseWalletMessage(ctx);
  }

  if (!ctx.session.walletName) {
    const walletName = text as string;
    if (clientWalletTypes.map((wt) => wt.name).includes(walletName)) {
      return setupWallet(ctx, walletName);
    } else {
      return chooseWallet(ctx);
    }
  }

  if (text.startsWith("/reconnect")) {
    return setupWallet(ctx, ctx.session.walletName);
  }

  if (!account) {
    return ctx.reply(i18next.t("pleaseConnectYourWalletFirst"));
  }

  return handleConnectedUserState(ctx, text);
}

export function getReplyLink(
  ctx: TelegramBotContext,
  messageId: string | number
) {
  return `https://t.me/${getBotInfo(ctx).username}?start=${
    ParameterKey.REPLY
  }=${messageId}`;
}

export async function handleMessage(ctx: TelegramBotContext) {
  // @ts-ignore
  if (!ctx.message && !ctx.match[0]) return;
  if (ctx.message && String(ctx.message.chat.id) === GOT_DEFAULT_CHAT_ID) {
    if (
      "is_automatic_forward" in ctx.message &&
      ctx.message.is_automatic_forward
    ) {
      return ctx.reply(
        `[${i18next.t("sendMessage.commentOnThisPost")}](${getReplyLink(
          ctx,
          ctx.message.message_id
        )})`,
        {
          reply_to_message_id: ctx.message.message_id,
          parse_mode: "Markdown",
        }
      );
    }
  }
  return handlePrivateTextMessage(ctx);
}
