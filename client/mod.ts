import { SMTPWorkerPool } from "./pool.ts";
import { SMTPWorker } from "./worker/worker.ts";
import { SMTPClient } from "./basic/client.ts";
import {
  ClientOptions,
  resolveClientOptions,
  ResolvedClientOptions,
} from "../config/client.ts";
import {
  resolveSendConfig,
  SendConfig,
  validateConfig,
} from "../config/mail/mod.ts";

/**
 * SMTP-Client with support for pool, etc.
 * ```ts
 * const client = new SMTPClient({
 *   connection: {
 *     hostname: "smtp.example.com",
 *     port: 465,
 *     tls: true,
 *     auth: {
 *       username: "example",
 *       password: "password",
 *     },
 *   },
 * });
 *
 * await client.send({
 *   from: "me@example.com",
 *   to: "you@example.com",
 *   subject: "example",
 *   content: "...",
 *   html: "<p>...</p>",
 * });
 *
 * await client.close();
 * ```
 */
export class SMTPHandler {
  #internalClient: SMTPWorker | SMTPWorkerPool | SMTPClient;
  #clientConfig: ResolvedClientOptions;

  /**
   * create a new SMTPClient
   *
   * ```ts
   * const client = new SMTPClient({
   *   connection: {
   *     hostname: "smtp.example.com",
   *     port: 465,
   *     tls: true,
   *     auth: {
   *       username: "example",
   *       password: "password",
   *     },
   *   },
   *   pool: {
   *     size: 2,
   *     timeout: 60000
   *   },
   *   client: {
   *     warning: 'log',
   *     preprocessors: [filterBurnerMails]
   *   },
   *   debug: {
   *     log: false,
   *     allowUnsecure: false,
   *     encodeLB: false,
   *     noStartTLS: false
   *   }
   * });
   *
   * ```
   *
   * @param config client config
   */
  constructor(config: ClientOptions) {
    const resolvedConfig = resolveClientOptions(config);

    resolvedConfig.client.preprocessors.push(validateConfig);

    this.#clientConfig = resolvedConfig;

    if (resolvedConfig.debug.log) {
      console.log("used resolved config");
      console.log(".debug");
      console.table(resolvedConfig.debug);
      console.log(".connection");
      console.table({
        ...resolvedConfig.connection,
        ...resolvedConfig.connection.auth
          ? { auth: JSON.stringify(resolvedConfig.connection.auth) }
          : {},
      });
      console.log(".pool");
      console.table(resolvedConfig.pool);
    }

    const Client = resolvedConfig.pool
      ? (resolvedConfig.pool.size > 1 ? SMTPWorkerPool : SMTPWorker)
      : SMTPClient;

    this.#internalClient = new Client(resolvedConfig);
  }

  /**
   * Sends a E-Mail with the correspondig config.
   * TODO: examples
   * @param config Email config
   * @returns nothing (for now as this might change in the future!)
   */
  send(config: SendConfig): Promise<void> {
    let resolvedConfig = resolveSendConfig(config);

    for (let i = 0; i < this.#clientConfig.client.preprocessors.length; i++) {
      const cb = this.#clientConfig.client.preprocessors[i];

      resolvedConfig = cb(resolvedConfig, this.#clientConfig);
    }

    return this.#internalClient.send(resolvedConfig);
  }

  /**
   * Closes the connection (kills all Worker / closes connection)
   */
  close(): void | Promise<void> {
    return this.#internalClient.close();
  }
}
