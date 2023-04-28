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

dotenv.config();

async function setupBot() {
  if (process.env.BOT_API_TOKEN === undefined) {
    throw new Error("Please provide the BOT_API_TOKEN in .env file");
  }
  await Promise.all([
    store.dispatch(fetchReputationGraphMetadata()),
    store.dispatch(fetchGraphId()),
    store.dispatch(fetchScores()),
    store.dispatch(fetchNicknames())
  ]);
  await setupI18n();

  const bot = new Telegraf<TelegrafContext>(process.env.BOT_API_TOKEN);
  bot.use(session());
  bot.on("message", async (ctx) => {
    handleMessage(
      Object.assign(ctx, {
        session: ctx.session ?? getInitialState(),
      })
    );
  });
  bot.launch();

  setInterval(() => {
    store.dispatch(fetchScores());
    store.dispatch(fetchNicknames());
  }, 10000);
}

setupBot();
