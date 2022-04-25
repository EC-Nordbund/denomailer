export type { SendConfig } from "./config/mail/mod.ts";
export type { ClientOptions, Preprocessor } from "./config/client.ts";
export { SMTPHandler as SMTPClient } from "./client/mod.ts";
export { quotedPrintableEncode } from "./config/mail/encoding.ts";
