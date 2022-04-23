export type { SendConfig } from "./config.ts";
export { createSMTPConnection } from './entry.ts'
export type {ClientOptions} from './entry.ts'
export { SMTPWorker, SMTPWorkerPool } from './pool.ts'
export { SmtpClient } from "./smtp.ts";
export { quotedPrintableEncode } from "./encoding.ts";
