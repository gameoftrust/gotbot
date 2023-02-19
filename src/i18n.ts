import { I18n } from "i18n";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export const i18n = new I18n({
  locales: ["fa"],
  directory: path.join(__dirname, "../locales"),
  defaultLocale: "fa",
  retryInDefaultLocale: true,
});

i18n.setLocale(process.env.LOCALE || "fa");
