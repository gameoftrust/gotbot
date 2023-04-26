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
  getGroupInvitationLink,
  getTelegramApi,
  replyMarkupArguments,
  sendMainMenuMessage,
  sendUserProfileLink,
} from "./index";
import { GROUP_ID } from "../constants";

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
  let isDiscussionGroup = true;
  let groupLink = "";
  try {
    groupLink = (await getGroupInvitationLink(ctx)).invite_link;
    const gpInfo = await getTelegramApi(ctx).getChat(GROUP_ID);
    // @ts-ignore
    isDiscussionGroup = !!gpInfo.linked_chat_id;
  } catch (e) {
    console.log(e);
  }
  return ctx.reply(
    i18next.t("sendMessage.sendReplyMessageLink", {
      groupLink,
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
  return text.includes("https://") || text.includes("http://")
}

export async function handleSendMessageFlow(
  ctx: TelegramBotContext,
  message: string | null
) {
  const { account, scene } = getSession(ctx);
  if (!account) throw new Error("account not provided");

  if (scene === Scene.INITIAL) {
    if (canAccessGroup(account)) {
      if (message === i18next.t("sendMessage.sendMessageInGroup")) {
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
      if (!GROUP_ID.endsWith(chatId) || !msgId) {
        let groupName = "";
        try {
          const gpInfo = await getTelegramApi(ctx).getChat(GROUP_ID);
          // @ts-ignore
          groupName = gpInfo.title;
        } catch (e) {
          console.log(e);
        }
        return ctx.reply(
          i18next.t("sendMessage.invalidReplyMessageChat", {
            groupName,
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
        GROUP_ID,
        text, //[‌](https://www.google.com/${signature})
        {
          disable_web_page_preview: !containsLink(message),
          reply_to_message_id: ctx.session.messageIdToReply,
          parse_mode: "Markdown",
        }
      );
      const gpInfo = await getTelegramApi(ctx).getChat(GROUP_ID);
      // @ts-ignore
      const isForum = !!gpInfo.is_forum;
      const baseLink =
        `https://t.me/c/${GROUP_ID.substring(4)}/` + (isForum ? "1/" : "");
      await ctx.reply(
        i18next.t("sendMessage.messageWasSentSuccessfully", {
          messageLink: baseLink + res.message_id,
        }),
        {
          parse_mode: "Markdown",
        }
      );
    } catch (e) {
      // @ts-ignore
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
