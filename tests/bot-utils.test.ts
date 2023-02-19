import { TelegramBotContext } from "../types";
import { handleMessage } from "../src/bot-utils/index";
import { getInitialState } from "../src/session-utils";
import { setupI18n } from "../src/i18n";

function getBasicContext(text: string): TelegramBotContext {
  const context: Partial<TelegramBotContext> = {
    botInfo: {
      id: 2,
      is_bot: true,
      username: "testbot",
      can_join_groups: true,
      first_name: "Game of Trust",
      can_read_all_group_messages: true,
      supports_inline_queries: false,
    },
    message: {
      message_id: 10,
      date: Date.now(),
      text,
      chat: { type: "private", id: 1, first_name: "first name" },
      from: { id: 1, is_bot: false, first_name: "first name" },
    },
    session: getInitialState(),
    reply: jest.fn(),
    replyWithPhoto: jest.fn(),
  };
  return context as TelegramBotContext;
}

describe("bot", () => {
  beforeAll(async () => {
    await setupI18n();
  });

  it("sample test", async () => {
    const ctx = getBasicContext("hi");
    await handleMessage(ctx);
    expect(ctx.reply).toHaveBeenCalled();
  });
});
