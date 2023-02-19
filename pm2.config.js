const { join } = require("path");

module.exports = {
  apps: [
    {
      name: "GotBot",
      script: "dist/src/bot.js",
      watch: false,
    },
  ],
};
