import { SMTPWorkerPool } from "./pool.ts";
import { SMTPWorker } from "./worker.ts";
import { SMTPClient } from "./smtp.ts";
import { ClientOptions, resolveClientOptions, ResolvedClientOptions } from "../config/client/mod.ts";
import { SendConfig, resolveSendConfig, validateConfig } from "../config/mail/mod.ts";

/**
 * TODO
 */
export class SMTPHandler {
  #internalClient: SMTPWorker | SMTPWorkerPool | SMTPClient
  #clientConfig: ResolvedClientOptions
  
  /**
   * TODO
   * @param config 
   */
  constructor(config: ClientOptions) {
    const resolvedConfig = resolveClientOptions(config)

    resolvedConfig.client.preprocessors.push(validateConfig)

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

    const Client = resolvedConfig.pool ? (resolvedConfig.pool.size > 1 ? SMTPWorkerPool : SMTPWorker) : SMTPClient

    this.#internalClient = new Client(resolvedConfig)
  }

  /**
   * TODO
   * @param config 
   * @returns 
   */
  send(config: SendConfig): Promise<void> {
    let resolvedConfig = resolveSendConfig(config)

    for (let i = 0; i < this.#clientConfig.client.preprocessors.length; i++) {
      const cb = this.#clientConfig.client.preprocessors[i];
      
      resolvedConfig = cb(resolvedConfig, this.#clientConfig)
    }

    return this.#internalClient.send(resolvedConfig)
  }

  /**
   * TODO
   * @returns 
   */
  close(): void | Promise<void> {
    return this.#internalClient.close()
  }
}
