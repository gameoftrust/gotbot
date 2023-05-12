import { Scene, TelegramBotContext } from "../../types";
import { getSession, resetSession } from "../session-utils";
import i18next from "i18next";
import {
  createKeyboard,
  handleConnectedUserState,
  replyMarkupArguments,
} from "./index";

export async function VPNAgreementScene(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("VPNAgreement"), {
    parse_mode: "Markdown",
    ...replyMarkupArguments(
      createKeyboard([[i18next.t("okGotIt")!], [i18next.t("cancel")!]])
    ),
  });
}

export async function handleVPNFlow(
  ctx: TelegramBotContext,
  message: string | null
) {
  const { account, scene, nicknameWarningAcknowledged } = getSession(ctx);
  if (!account) throw new Error("account not provided");

  if (message === i18next.t("cancel")) {
    resetSession(ctx);
    return handleConnectedUserState(ctx);
  }

  if (scene === Scene.INITIAL) {
    ctx.session.scene = Scene.VPN_AGREEMENT;
    return VPNAgreementScene(ctx);
  }

  if (scene === Scene.VPN_AGREEMENT && message === i18next.t("okGotIt")) {
    await ctx.reply(i18next.t("VPNGuide"), {
      disable_web_page_preview: true,
      parse_mode: "Markdown",
    });
    await ctx.reply(process.env.VPN_CONFIG || "VPN Config not provided", {
      parse_mode: "Markdown",
    });
    resetSession(ctx);
    return handleConnectedUserState(ctx);
  }
  return VPNAgreementScene(ctx);
}
