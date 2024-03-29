import * as dotenv from "dotenv";
import { handleMessage } from "./bot-utils";
import { TelegrafContext } from "../types";
import { store } from "./store";
import { setupI18n } from "./i18n";
import { session, Telegraf } from "telegraf";
import { getInitialState } from "./session-utils";
import { fetchNicknames } from "./store/nickname/actions";
import {
  fetchGraphId,
  fetchReputationGraphMetadata,
  fetchScores,
} from "./store/reputationGraph/actions";
import { getChatInfo } from "./store/gotSpaces/actions";
import { GOT_DEFAULT_CHAT_ID } from "./constants";
import { handleChatJoinRequest } from "./bot-utils/gotSpaceManagement";

dotenv.config();

async function setupBot() {
  if (process.env.BOT_API_TOKEN === undefined) {
    throw new Error("Please provide the BOT_API_TOKEN in .env file");
  }
  const bot = new Telegraf<TelegrafContext>(process.env.BOT_API_TOKEN);
  await Promise.all([
    store.dispatch(fetchReputationGraphMetadata()),
    store.dispatch(fetchGraphId()),
    store.dispatch(fetchScores()),
    store.dispatch(fetchNicknames()),
    store.dispatch(getChatInfo({ bot, chatId: GOT_DEFAULT_CHAT_ID })),
  ]);
  await setupI18n();
  bot.use(session());
  bot.on("message", (ctx) => {
    handleMessage(
      Object.assign(ctx, {
        session: ctx.session ?? getInitialState(),
      })
    ).catch(console.log);
  });
  bot.on("chat_join_request", (ctx) => {
    handleChatJoinRequest(
      Object.assign(ctx, {
        session: ctx.session ?? getInitialState(),
      })
    ).catch(console.log);
  });
  bot.action(/.+/, (ctx) => {
    handleMessage(
      Object.assign(ctx, {
        session: ctx.session ?? getInitialState(),
      })
    ).catch(console.log);
    return ctx.answerCbQuery();
  });
  bot.launch();

  setInterval(() => {
    store.dispatch(fetchScores());
    store.dispatch(fetchNicknames());
  }, 10000);
}

setupBot();
