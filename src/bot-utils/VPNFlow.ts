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
    await ctx.reply(process.env.VPN_CONFIG || "VPN Config not provided");
    await ctx.reply(
      "برنامه ی مناسب برای دستگاهتون رو از لینک های زیر دانلود کنید و کانفیگ بالا رو داخلش وارد کنید. اگر راهنمایی لازم داشتید به @gotbotsup پیام بدید.\n" +
        "\n" +
        "[ویندوز](https://github.com/2dust/v2rayN/releases/download/6.23/v2rayN.zip)\n" +
        "\n" +
        "[اندروید](https://github.com/2dust/v2rayNG/releases/download/1.8.3/v2rayNG_1.8.3.apk)\n" +
        "\n" +
        "[آی او اس](https://apps.apple.com/us/app/wings-x/id6446119727)\n" +
        "\n" +
        "حتما آخرین نسخه رو از لینک های داده شده دانلود و نصب کنید، و ساعت سیستمتون هم روی حالت خودکار باشه، وگرنه کانفیگ کار نمی کنه",
      {
        disable_web_page_preview: true,
        parse_mode: "Markdown",
      }
    );
    resetSession(ctx);
    return handleConnectedUserState(ctx);
  }
  return VPNAgreementScene(ctx);
}
