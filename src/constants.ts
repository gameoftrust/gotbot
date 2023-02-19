if (process.env.GROUP_ID === undefined) {
  throw new Error("Please provide the GROUP_ID in .env file");
}
const GROUP_ID = process.env.GROUP_ID;
const EXPLORER_URL = process.env.BLOCKCHAIN_EXPLORER_URL;

export { GROUP_ID, EXPLORER_URL };
