import NodeWalletConnect from "@walletconnect/client";
import {
  ClientWallet,
  TelegramBotContext,
  UserDeniedWalletActionError,
} from "../types";
import qr from "qrcode";
import { Markup } from "telegraf";
import { getSession } from "./session-utils";
import i18next from "i18next";
import {createKeyboard, replyMarkupArguments} from "./bot-utils";
import { v4 as uuidv4 } from "uuid";
import { addWalletConnection } from "./store/walletConnections";
import { store } from "./store";
import { keccak256 } from "@ethersproject/keccak256";

type ClientWalletType = {
  name: string;
  deeplink?: string;
  supportsOpenAppByDeeplinkAfterConnect?: boolean;
};

export const clientWalletTypes: ClientWalletType[] = [
  {
    name: "Trust Wallet",
    deeplink: "https://link.trustwallet.com/",
    supportsOpenAppByDeeplinkAfterConnect: true,
  },
  {
    name: "MetaMask Mobile",
    deeplink: "https://metamask.app.link/",
    supportsOpenAppByDeeplinkAfterConnect: true,
  },
  {
    name: "Elastos Essentials",
    deeplink: "https://essentials.elastos.net/",
    supportsOpenAppByDeeplinkAfterConnect: true,
  },
  {
    name: "Avacus",
    deeplink: "https://avacus.app.link/",
    supportsOpenAppByDeeplinkAfterConnect: false,
  },
];

export async function initializeClientWallet(
  ctx: TelegramBotContext,
  walletName: string,
  onConnect: () => void
): Promise<ClientWallet> {
  const clientWallet = new NodeWalletConnect({
    bridge: "https://bridge.walletconnect.org", // Required
    clientMeta: {
      description: "Game of Trust",
      url: "https://gameoftrust.xyz/",
      icons: ["https://nodejs.org/static/images/logo.svg"],
      name: "GameOfTrust",
    },
  });
  await clientWallet.createSession();
  clientWallet.on("connect", async (error, payload) => {
    await killWalletConnectSession(ctx.session.clientWallet);
    const newAccount: string = payload.params[0].accounts[0];
    // TODO: ask user to sign a typedData to login to the bot
    ctx.session.account = newAccount;
    store.dispatch(
      addWalletConnection({
        accountHash: keccak256(newAccount.toLowerCase()),
        timestamp: Date.now(),
        userId: ctx.message!.chat.id,
      })
    );
    ctx.session.clientWallet = clientWallet;
    onConnect();
  });
  const uri = clientWallet.uri;

  const deeplinkBase = clientWalletTypes.find(
    (wt) => wt.name === walletName
  )!.deeplink;

  const deeplinkUri = deeplinkBase + "wc?uri=" + encodeURIComponent(uri);
  // console.log("safepalwallet://wc?uri=" + uri);
  ctx.session.openWalletParameter = "wc?uri=" + uri.split("?")[0];
  const qrBase64Url = await qr.toDataURL(uri);
  const qrBuffer = Buffer.from(qrBase64Url.substring(22), "base64");

  // grammyjs version
  // await ctx.replyWithPhoto(new InputFile(qrBuffer), {
  //   caption: i18next.t("scanQrOrOpenWallet", { walletName }),
  //   ...replyMarkupArguments(
  //     new InlineKeyboard().url(i18next.t("openWallet"), deeplinkUri)
  //   ),
  // });

  await ctx.replyWithPhoto(
    { source: qrBuffer },
    {
      caption: i18next.t("scanQrOrOpenWallet", { walletName }),
      ...Markup.inlineKeyboard([
        Markup.button.url(i18next.t("openWallet"), deeplinkUri),
      ]),
      ...Markup.removeKeyboard()
    }
  );
  return clientWallet;
}

export function openWalletButton(ctx: TelegramBotContext) {
  const { walletName, openWalletParameter } = getSession(ctx);
  if (!walletName) throw new Error("walletName not provided");

  const walletTypeObj = clientWalletTypes.find((wt) => wt.name === walletName);
  if (
    walletTypeObj?.deeplink &&
    walletTypeObj.supportsOpenAppByDeeplinkAfterConnect
  ) {
    return {
      ...Markup.inlineKeyboard([
        Markup.button.url(
          i18next.t("openWallet"),
          walletTypeObj.deeplink + openWalletParameter
        ),
      ]),
    };
  }
  return {};
}

export async function runPendingWalletAction(ctx: TelegramBotContext) {
  const id = uuidv4();
  if (!ctx.session.clientWallet) return;
  if (!ctx.session.pendingWalletAction) return;
  const { walletAction, resolve, reject } = ctx.session.pendingWalletAction;
  ctx.session.pendingWalletAction.id = id;
  walletAction(ctx.session.clientWallet)
    .then((res) => {
      if (id === ctx.session.pendingWalletAction?.id) {
        ctx.session.pendingWalletAction = null;
        resolve(res);
      }
    })
    .catch((e) => {
      if (id === ctx.session.pendingWalletAction?.id) {
        ctx.session.pendingWalletAction = null;
        const message = e?.message;
        if (message) {
          const filterStrings = ["cancel", "denied", "deny", "reject"];
          const regex = new RegExp(filterStrings.join("|"), "i");
          if (regex.test(message)) {
            reject(new UserDeniedWalletActionError());
          }
        }
        reject(e);
      }
    });
}

export async function signTypedDataWithClientWallet(
  ctx: TelegramBotContext,
  typedData: string
) {
  return new Promise<string | null>((resolve, reject) => {
    const session = getSession(ctx);

    const { clientWallet, account } = session;
    if (!clientWallet || !account) {
      reject(new Error("wallet is not connected"));
      return;
    }

    const msgParams = [
      account, // Required
      JSON.stringify(eval(`(${typedData})`)), // Required
    ];

    const customRequest = {
      id: 1337,
      jsonrpc: "2.0",
      method: "eth_signTypedData_v4",
      params: msgParams,
    };

    ctx.session.pendingWalletAction = {
      walletAction: (activeClientWallet: ClientWallet) => {
        ctx.reply(
          i18next.t("confirmSignature") +
            i18next.t("signatureReconnectWalletHelpMessage"),
          {
            ...replyMarkupArguments(openWalletButton(ctx)),
          }
        );
        return activeClientWallet.sendCustomRequest(customRequest);
      },
      resolve,
      reject,
    };
    runPendingWalletAction(ctx);
  });
}

export async function signPersonalMessageWithClientWallet(
  ctx: TelegramBotContext,
  message: string
) {
  return new Promise<string | null>((resolve, reject) => {
    const { clientWallet, account } = getSession(ctx);
    if (!clientWallet || !account) {
      reject(new Error("wallet is not connected"));
      return;
    }

    ctx.session.pendingWalletAction = {
      walletAction: (activeClientWallet: ClientWallet) => {
        ctx.reply(
          i18next.t("sendMessage.confirmTextMessageSignature") +
            i18next.t("signatureReconnectWalletHelpMessage"),
          {
            ...replyMarkupArguments(openWalletButton(ctx)),
          }
        );
        return activeClientWallet.signPersonalMessage([account, message]);
      },
      resolve,
      reject,
    };
    runPendingWalletAction(ctx);
  });
}

export async function killWalletConnectSession(
  clientWallet: ClientWallet | null | undefined
) {
  try {
    await clientWallet?.killSession?.().catch(console.log);
  } catch (e) {
    console.log(e);
  }
}
