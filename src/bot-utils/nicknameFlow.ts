import { NICKNAME_CONTRACT_ADDRESS, nicknameContract, web3 } from "../web3";
import {
  Scene,
  TelegramBotContext,
  UserDeniedWalletActionError,
} from "../../types";
import { getSession, resetSession } from "../session-utils";
import { signTypedDataWithClientWallet } from "../client-wallet";
import i18next from "i18next";
import {
  createKeyboard,
  handleConnectedUserState,
  replyMarkupArguments,
} from "./index";
import { Nickname } from "../../types/web3-v1-contracts";
import { store } from "../store";
import { fetchNicknames } from "../store/nickname/actions";
import fs from "fs";
import { EXPLORER_URL } from "../constants";

export function getNicknameTypedData(
  account: string,
  nickname: string,
  timestamp: number
) {
  const domain = {
    name: "Game of Trust Nickname",
    version: "1",
  };
  const types = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
    ],
    NicknameObject: [
      { name: "account", type: "address" },
      { name: "nickname", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
  };
  const message = {
    account,
    nickname,
    timestamp,
  };
  const typedData = {
    domain,
    message,
    types,
    primaryType: "NicknameObject",
  };
  return JSON.stringify(typedData);
}

export async function setNicknameWithSignature(
  ...args: Parameters<Nickname["methods"]["setNicknameWithSignedData"]>
) {
  const privateKey = process.env.NICKNAME_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("privateKey is required");
  const fromAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address;

  const nonce = await web3.eth.getTransactionCount(fromAddress);
  const gasPrice = await web3.eth.getGasPrice();
  const data = nicknameContract.methods
    .setNicknameWithSignedData(...args)
    .encodeABI();

  const tx = {
    from: fromAddress,
    to: NICKNAME_CONTRACT_ADDRESS,
    data: data,
    nonce: nonce,
    gasPrice: gasPrice,
  };
  const gasLimit = await web3.eth.estimateGas(tx);

  const txWithGasEstimation = {
    ...tx,
    gasLimit: gasLimit,
  };

  const signedTx = await web3.eth.accounts.signTransaction(
    txWithGasEstimation,
    privateKey
  );
  return web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
}

export async function submitNickname(
  ctx: TelegramBotContext,
  newNickname: string
) {
  const { account } = getSession(ctx);
  if (!account) throw new Error("account not provided");
  const timestamp = Math.floor(Date.now() / 1000);
  const typedData = getNicknameTypedData(account, newNickname, timestamp);
  let signature: string | null = null;
  try {
    signature = await signTypedDataWithClientWallet(ctx, typedData);
  } catch (e) {
    if (e instanceof UserDeniedWalletActionError) {
      await ctx.reply(i18next.t("signatureRejected"));
    } else {
      console.log(e);
      await ctx.reply(String(e));
    }
  }
  if (signature) {
    await ctx.reply(i18next.t("signatureAccepted"));
    try {
      const nicknameObject: Parameters<
        Nickname["methods"]["setNicknameWithSignedData"]
        >[0] = [account, newNickname, timestamp];
      if (process.env.NICKNAME_CONTRACT_CALL_LOG_PATH) {
        fs.appendFile(
          process.env.NICKNAME_CONTRACT_CALL_LOG_PATH,
          JSON.stringify({
            nicknameObject,
            signature,
          }),
          (err) => {
            if (err) {
              console.error("Error appending to file:", err);
            }
          }
        );
      }
      const tx = await setNicknameWithSignature(nicknameObject, signature);
      store.dispatch(fetchNicknames());
      const txLink = EXPLORER_URL
        ? "\n\n" +
        i18next.t("transactionExplorerLink", {
          txLink: `${EXPLORER_URL}/tx/${tx.transactionHash}`,
        })
        : "";
      await ctx.reply(i18next.t("nickname.nicknameSubmitted") + txLink, {
        parse_mode: "MarkdownV2",
      });
    } catch (e) {
      console.log(e);
      await ctx.reply(i18next.t("txError"));
      await ctx.reply(String(e));
    }
  }
  resetSession(ctx);
  return handleConnectedUserState(ctx);
}

export async function handleSetNicknameFlow(
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
    ctx.session.scene = Scene.SET_NICKNAME;
  }
  if (!nicknameWarningAcknowledged) {
    if (message === i18next.t("okGotIt")) {
      ctx.session.nicknameWarningAcknowledged = true;
      return ctx.reply(i18next.t("nickname.enterYourNickname"));
    }
    return ctx.reply(i18next.t("nickname.nicknamePrivacyWarning"), {
      parse_mode: "Markdown",
      ...replyMarkupArguments(
        createKeyboard([[i18next.t("okGotIt")!], [i18next.t("cancel")!]])
      ),
    });
  }
  if (scene === Scene.SET_NICKNAME && message) {
    return submitNickname(ctx, message);
  }
  return ctx.reply(i18next.t("nickname.enterYourNickname"));
}
