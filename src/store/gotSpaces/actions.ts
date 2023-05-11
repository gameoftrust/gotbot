import { createAsyncThunk } from "@reduxjs/toolkit";
import { Telegraf } from "telegraf";
import { TelegrafContext } from "../../../types";

export const getChatInfo = createAsyncThunk(
  "gotChatInfos/getChatInfo",
  async ({
    bot,
    chatId,
  }: {
    bot: Telegraf<TelegrafContext>;
    chatId: number | string;
  }) => {
    return await bot.telegram.getChat(chatId);
  }
);
