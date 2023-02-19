import { Markup } from "telegraf";
import {
  ClientWalletType,
  clientWalletTypes,
  ParameterName,
  ParameterTypes,
  TelegramBotContext,
} from "./types";
import { getSession, resetSession } from "./session-utils";
import {
  initializeClientWallet,
  signTypedDataWithClientWallet,
} from "./client-wallet";
import { i18n } from "./i18n";

function isNullish(value: any) {
  return value === null || value === undefined;
}

function isNumberType(paramType: ParameterTypes) {
  return paramType === ParameterTypes.UINT || paramType === ParameterTypes.INT;
}

function parseNumberParamValue(value: string) {
  return value.replace("_", "."); // to handle /start params
}

export async function sendWelcomeText(ctx: TelegramBotContext) {
  await ctx.reply("Welcome. send /reset anytime to reset the bot state");
  return chooseWallet(ctx);
}

export function isValidParamValue(
  ctx: TelegramBotContext,
  paramName: ParameterName,
  value: string
) {
  const session = getSession(ctx);
  let finalValue = value;
  if (!session.parameterObjects[paramName]) return false;
  const paramType = session.parameterObjects[paramName].type;
  if (isNumberType(paramType)) {
    finalValue = parseNumberParamValue(finalValue);
    if (isNaN(parseFloat(finalValue))) return false;
    if (paramType === ParameterTypes.UINT && parseFloat(finalValue) < 0)
      return false;
  }
  return true;
}

export function setParamValue(
  ctx: TelegramBotContext,
  paramName: ParameterName,
  value: string
) {
  const session = getSession(ctx);
  let finalValue = value;
  if (isNumberType(session.parameterObjects[paramName].type)) {
    finalValue = parseNumberParamValue(finalValue);
  }
  session.parameterObjects = {
    ...session.parameterObjects,
    [paramName]: {
      ...session.parameterObjects[paramName],
      value: finalValue,
    },
  };
}

export async function resetStateAndSendChooseWalletMessage(
  ctx: TelegramBotContext,
  silent = false
) {
  resetSession(ctx);
  if (!silent) {
    await ctx.reply("reset successfully!");
  }
  return chooseWallet(ctx);
}

async function prepareSignature(ctx: TelegramBotContext) {
  const { parameterObjects } = getSession(ctx);
  const typedData = parameterObjects[ParameterName.typedData].value;
  if (!typedData) throw new Error("typedData not provided");

  try {
    const sig = await signTypedDataWithClientWallet(ctx, typedData);
    await ctx.replyWithMarkdownV2("```" + sig + "```");
  } catch (e) {
    console.log(e);
    await ctx.reply("sign rejected! resetting the state.");
  } finally {
    await resetStateAndSendChooseWalletMessage(ctx, true);
  }
}

export async function handleParametersAndSetValueIfAvailable(
  ctx: TelegramBotContext,
  value: string | null = null
) {
  const session = getSession(ctx);
  const { parameterObjects } = session;
  const pnames = Object.values(ParameterName);
  let i = 0;
  while (i < pnames.length && !isNullish(parameterObjects[pnames[i]].value))
    i++;
  if (value) {
    if (i === pnames.length)
      return await ctx.reply("Waiting for transaction state");
    const paramName = pnames[i];
    if (!isValidParamValue(ctx, paramName, value)) {
      return await ctx.reply(
        `Enter a valid ${parameterObjects[paramName].title}`
      );
    }
    setParamValue(ctx, paramName, value);
    i++;
  }
  if (i < pnames.length) {
    return await ctx.reply(`Enter ${parameterObjects[pnames[i]].title}`);
  }
  return prepareSignature(ctx);
}

export async function setupWallet(
  ctx: TelegramBotContext,
  walletType: ClientWalletType
) {
  const session = getSession(ctx);
  try {
    const clientWallet = await initializeClientWallet(
      ctx,
      walletType,
      async (account) => {
        session.account = account;
        await ctx.reply("Wallet Connected!");
        await handleParametersAndSetValueIfAvailable(ctx);
      }
    );
    session.walletType = walletType;
    session.clientWallet?.killSession?.();
    session.clientWallet = clientWallet;
  } catch (e) {
    console.log(e);
    await ctx.reply(
      "There was an error while trying to connect wallet. Please try again"
    );
    return resetStateAndSendChooseWalletMessage(ctx);
  }
}

export async function chooseWallet(ctx: TelegramBotContext) {
  return ctx.reply(
    i18n.__("choose_wallet"),
    Markup.keyboard(clientWalletTypes.map((wt) => [wt]))
      .oneTime()
      .resize()
  );
}
