import { SMTPWorkerPool } from "./pool.ts";
import { SMTPWorker } from "./worker.ts";
import { SmtpClient } from "./smtp.ts";
import { ClientOptions, resolveClientOptions, ResolvedClientOptions } from "../config/client/mod.ts";
import { SendConfig, resolveSendConfig, validateConfig } from "../config/mail/mod.ts";

export class SMTPHandler {
  #internalClient: SMTPWorker | SMTPWorkerPool | SmtpClient
  #clientConfig: ResolvedClientOptions
  
  constructor(config: ClientOptions) {
    const resolvedConfig = resolveClientOptions(config)
    this.#clientConfig = resolvedConfig

    if(resolvedConfig.debug.log) {
      console.log('used resolved config')
      console.log('.debug')
      console.table(resolvedConfig.debug)
      console.log('.connection')
      console.table({...resolvedConfig.connection, ...resolvedConfig.connection.auth ? {auth: JSON.stringify(resolvedConfig.connection.auth)} : {}})
      console.log('.pool')
      console.table(resolvedConfig.pool)
    }

    const Client = resolvedConfig.pool ? (resolvedConfig.pool.size > 1 ? SMTPWorkerPool : SMTPWorker) : SmtpClient

    this.#internalClient = new Client(resolvedConfig)
  }

  send(config: SendConfig): Promise<void> {
    const resolvedConfig = resolveSendConfig(config)

    // TODO: add filter here!

    validateConfig(resolvedConfig, this.#clientConfig.client.warning)

    return this.#internalClient.send(resolvedConfig)
  }
  close(): void | Promise<void> {
    return this.#internalClient.close()
  }
}
