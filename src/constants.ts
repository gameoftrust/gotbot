if (process.env.GOT_DEFAULT_CHAT_ID === undefined) {
  throw new Error("Please provide the GOT_DEFAULT_CHAT_ID in .env file");
}
const GOT_DEFAULT_CHAT_ID = process.env.GOT_DEFAULT_CHAT_ID || "";
const EXPLORER_URL = process.env.BLOCKCHAIN_EXPLORER_URL;
const DEBUG = process.env.DEBUG === "true";
export { GOT_DEFAULT_CHAT_ID, EXPLORER_URL, DEBUG };
