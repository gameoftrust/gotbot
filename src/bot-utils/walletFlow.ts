import { TelegramBotContext } from "../../types";
import { disconnectWallet, resetSessionAndWallet } from "../session-utils";
import {
  clientWalletTypes,
  initializeClientWallet,
  runPendingWalletAction,
} from "../client-wallet";
import i18next from "i18next";
import {
  createKeyboard,
  handleConnectedUserState,
  replyMarkupArguments,
} from "./index";

export async function resetStateAndSendChooseWalletMessage(
  ctx: TelegramBotContext,
  silent = false
) {
  await resetSessionAndWallet(ctx);
  if (!silent) {
    await ctx.reply(i18next.t("resetSuccessfully"));
  }
  return chooseWallet(ctx);
}

export async function setupWallet(ctx: TelegramBotContext, walletName: string) {
  await disconnectWallet(ctx);
  ctx.session.walletName = walletName;
  try {
    await initializeClientWallet(ctx, walletName, async () => {
      await ctx.reply(i18next.t("walletConnected"));
      if (ctx.session.pendingWalletAction) {
        await runPendingWalletAction(ctx);
      } else {
        await handleConnectedUserState(ctx);
      }
    });
  } catch (e) {
    console.log(e);
    await ctx.reply(
      "There was an error while trying to connect wallet. Please try again"
    );
    return resetStateAndSendChooseWalletMessage(ctx);
  }
}

export async function chooseWallet(ctx: TelegramBotContext) {
  return ctx.reply(i18next.t("chooseWallet"), {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    ...replyMarkupArguments(
      createKeyboard(clientWalletTypes.map((wt) => [wt.name]))
    ),
  });
}
