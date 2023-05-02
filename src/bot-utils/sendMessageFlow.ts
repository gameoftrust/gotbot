import {
  Scene,
  TelegramBotContext,
  UserDeniedWalletActionError,
} from "../../types";
import { getSession, resetSession } from "../session-utils";
import { signTypedDataWithClientWallet } from "../client-wallet";
import i18next from "i18next";
import {
  addressRepresentationWithLink,
  canAccessGroup,
  createKeyboard,
  getChatInvitationLink,
  getTelegramApi,
  replyMarkupArguments,
  sendMainMenuMessage,
  sendUserProfileLink,
} from "./index";
import { GOT_DEFAULT_CHAT_ID } from "../constants";
import { selectDefaultChatInfo } from "../store/gotChatInfo/selectors";
import { store } from "../store";
import { getChatTypeTranslationArg } from "../i18n";

function initialSendMessageScene(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("sendMessage.isReplyToAnotherMessage"), {
    ...replyMarkupArguments(
      createKeyboard([
        [i18next.t("yes")],
        [i18next.t("no")],
        [i18next.t("cancel")],
      ])
    ),
  });
}

async function getReplyMessageScene(ctx: TelegramBotContext) {
  let chatLink = "";
  try {
    chatLink = (await getChatInvitationLink(ctx)).invite_link;
  } catch (e) {
    console.log(e);
  }
  const chatInfo = selectDefaultChatInfo(store.getState());
  const isDiscussionGroup = !!(
    "linked_chat_id" in chatInfo && chatInfo.linked_chat_id
  );
  return ctx.reply(
    i18next.t("sendMessage.sendReplyMessageLink", {
      chatLink,
      ...getChatTypeTranslationArg(),
    }) +
      (isDiscussionGroup
        ? i18next.t("sendMessage.commentOnChannelMessageHelp")
        : ""),
    {
      parse_mode: "Markdown",
      ...replyMarkupArguments(createKeyboard([[i18next.t("cancel")]])),
    }
  );
}

export function getMessageScene(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("sendMessage.enterTextMessage"), {
    ...replyMarkupArguments(createKeyboard([[i18next.t("cancel")]])),
  });
}

export function getSendMessageTypedData(account: string, message: string) {
  const domain = {
    name: "Game of Trust Send Message",
    version: "1",
  };
  const types = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
    ],
    SendMessage: [
      { name: "sender", type: "address" },
      { name: "message", type: "string" },
    ],
  };
  const typedData = {
    domain,
    message: {
      account,
      message,
    },
    types,
    primaryType: "SendMessage",
  };
  return JSON.stringify(typedData);
}

export function containsLink(text: string) {
  return text.includes("https://") || text.includes("http://");
}

export async function handleSendMessageFlow(
  ctx: TelegramBotContext,
  message: string | null
) {
  const { account, scene } = getSession(ctx);
  if (!account) throw new Error("account not provided");

  if (scene === Scene.INITIAL) {
    if (canAccessGroup(account)) {
      if (
        message ===
        i18next.t("sendMessage.sendMessageInChat", getChatTypeTranslationArg())
      ) {
        ctx.session.scene = Scene.SEND_MESSAGE_TO_GROUP_GET_MESSAGE;
        return getMessageScene(ctx);
      } else if (message === i18next.t("sendMessage.sendReplyOrComment")) {
        ctx.session.scene = Scene.SEND_MESSAGE_TO_GROUP_GET_REPLY_MESSAGE;
        return getReplyMessageScene(ctx);
      }
      return sendMainMenuMessage(ctx);
    } else {
      return sendUserProfileLink(ctx);
    }
  }

  if (message === i18next.t("cancel")) {
    resetSession(ctx);
    return sendMainMenuMessage(ctx);
  }

  if (scene === Scene.SEND_MESSAGE_TO_GROUP_GET_REPLY_MESSAGE) {
    if (message) {
      const [msgId, chatId] = message.split("/").reverse();
      if (!GOT_DEFAULT_CHAT_ID.endsWith(chatId) || !msgId) {
        const chatInfo = selectDefaultChatInfo(store.getState());
        const chatName = "title" in chatInfo ? chatInfo.title : "";
        return ctx.reply(
          i18next.t("sendMessage.invalidReplyMessageChat", {
            chatName,
            ...getChatTypeTranslationArg(),
          }),
          {
            ...replyMarkupArguments(createKeyboard([[i18next.t("cancel")]])),
          }
        );
      }
      ctx.session.scene = Scene.SEND_MESSAGE_TO_GROUP_GET_MESSAGE;
      ctx.session.messageIdToReply = Number(msgId);
      return getMessageScene(ctx);
    }
    return getReplyMessageScene(ctx);
  }

  if (message) {
    if (process.env.REQUIRE_SIGNATURE_FOR_MESSAGE === "true") {
      const typedData = getSendMessageTypedData(account, message);
      try {
        await signTypedDataWithClientWallet(ctx, typedData);
      } catch (e) {
        resetSession(ctx);
        if (e instanceof UserDeniedWalletActionError) {
          await ctx.reply(i18next.t("signatureRejected"));
        } else {
          console.log(e);
          await ctx.reply(String(e));
        }
        return sendMainMenuMessage(ctx);
      }
    }
    const text = `${message}\n\n${addressRepresentationWithLink(
      ctx,
      account,
      false
    )}`;
    try {
      const res = await getTelegramApi(ctx).sendMessage(
        GOT_DEFAULT_CHAT_ID,
        text, //[‌](https://www.google.com/${signature})
        {
          disable_web_page_preview: !containsLink(message),
          reply_to_message_id: ctx.session.messageIdToReply,
          parse_mode: "Markdown",
        }
      );
      const chatInfo = selectDefaultChatInfo(store.getState());
      const isForum = !!("is_forum" in chatInfo && chatInfo.is_forum);
      const baseLink =
        `https://t.me/c/${GOT_DEFAULT_CHAT_ID.substring(4)}/` +
        (isForum ? "1/" : "");
      await ctx.reply(
        i18next.t("sendMessage.messageWasSentSuccessfully", {
          messageLink: baseLink + res.message_id,
        }),
        {
          parse_mode: "Markdown",
        }
      );
    } catch (e: any) {
      if (e?.description === "Bad Request: message is too long") {
        return ctx.reply(i18next.t("sendMessage.longMessageError"));
      }
      console.log(e);
      await ctx.reply(String(e));
    }
    resetSession(ctx);
    return sendMainMenuMessage(ctx);
  }
  return getMessageScene(ctx);
}
