import {
  ParameterName,
  ParameterTypes,
  SessionData,
  TelegramBotContext,
} from "./types";

export const getInitialState = (): SessionData => ({
  parameterObjects: {
    [ParameterName.typedData]: {
      title: "Typed Data",
      type: ParameterTypes.STRING,
      value: null,
    },
  },
  walletType: null,
  clientWallet: null,
  account: null,
});

export function resetSession(ctx: TelegramBotContext) {
  if (ctx.session) {
    const connector = ctx.session?.clientWallet;
    const initialState = getInitialState();
    for (const key in ctx.session) {
      // @ts-ignore
      ctx.session[key] = initialState[key];
    }
    connector?.killSession?.();
  } else {
    ctx.session = getInitialState();
  }
}

export function getSession(ctx: TelegramBotContext) {
  if (!ctx.session) throw new Error("Session is undefined");
  return ctx.session;
}
