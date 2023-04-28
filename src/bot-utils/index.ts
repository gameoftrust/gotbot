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
import { clientWalletTypes } from "../client-wallet";
import { Markup } from "telegraf";
import { handleViewUserFlow } from "./viewUserFlow";
import { getMessageScene, handleSendMessageFlow } from "./sendMessageFlow";
import { GROUP_ID } from "../constants";
import { handleSetNicknameFlow } from "./nicknameFlow";
import { addressToRepresentation } from "../web3";
import { handleVPNFlow } from "./VPNFlow";

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
    [i18next.t("sendMessage.sendMessageInGroup")],
    [i18next.t("sendMessage.sendReplyOrComment")],
    [i18next.t("getGroupInvitationLink"), "VPN"],
    [i18next.t("nickname.setNickname"), i18next.t("getProfileLink")],
  ]);
}

export function sendMainMenuMessage(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("mainMenu"), {
    ...replyMarkupArguments(getMainMenuKeyboard()),
  });
}

export async function getGroupInvitationLink(ctx: TelegramBotContext) {
  return getTelegramApi(ctx).createChatInviteLink(GROUP_ID, {
    member_limit: 1,
  });
}

export async function handleConnectedUserState(
  ctx: TelegramBotContext,
  message: string | null = null
): Promise<any> {
  const session = getSession(ctx);
  const { account, userToEndorse, userToView, walletName, scene } = session;
  if (!account) throw new Error("account not provided");
  if (!walletName) throw new Error("walletName not provided");

  if (userToEndorse) {
    return handleEndorsementFlow(ctx, message);
  }

  if (userToView) {
    return handleViewUserFlow(ctx, message);
  }

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

  if (
    SEND_MESSAGE_SCENES.includes(scene) ||
    (scene === Scene.INITIAL &&
      (message === i18next.t("sendMessage.sendMessageInGroup") ||
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
    if (message === i18next.t("getGroupInvitationLink")) {
      if (canAccessGroup(account)) {
        try {
          const inviteLink = await getGroupInvitationLink(ctx);
          await ctx.reply(
            i18next.t("inviteToGroup", {
              inviteLink: inviteLink.invite_link,
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

async function handleTgnumRequest(ctx: TelegramBotContext) {
  if (!ctx.message) throw new Error("ctx.message not provided");
  await getTelegramApi(ctx).sendMessage(
    Number(process.env.BOT_SUPPORT_ACCOUNT_USER_ID),
    `id: ${ctx.message.from.id}\nusername: @${ctx.message.from.username}`
  );
  await ctx.reply(i18next.t("requestWasSubmittedWellReachOutToYouShortly"));
}

export async function handlePrivateTextMessage(ctx: TelegramBotContext) {
  // @ts-ignore
  const text = ctx.message?.text;
  if (!text) return;
  if (process.env.DEBUG === "true") {
    console.log(
      new Date().getTime() +
        " " +
        ctx.message.from.id +
        " " +
        ctx.message.from.username +
        ":" +
        text
    );
  }

  if (text.startsWith("/start")) {
    const query = text.substring(7);
    if (query === "tgnum" && process.env.BOT_SUPPORT_ACCOUNT_USER_ID) {
      await handleTgnumRequest(ctx);
    } else {
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
          ctx.session.messageIdToReply = value;
          return getMessageScene(ctx);
        }
      }
    }
  }

  if (text === "/tgnum") {
    await handleTgnumRequest(ctx);
  }

  const { account } = ctx.session;
  if (text.startsWith("/start")) {
    if (!account) {
      await ctx.reply(i18next.t("welcome"));
    }
  }

  if (text === "/reset") {
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

  if (text === "/reconnect") {
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
  if (!ctx.message) return;
  const messageType = ctx.message.chat.type;
  if (messageType === "private") {
    return handlePrivateTextMessage(ctx);
  } else if (String(ctx.message.chat.id) === GROUP_ID) {
    // @ts-ignore
    if (ctx.message.is_automatic_forward) {
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
}
