import { ResolvedSendConfig } from "../config/mail/mod.ts";
import { ResolvedClientOptions } from '../config/client/mod.ts'
import { SMTPWorker } from "./worker.ts";

export class SMTPWorkerPool {
  pool: SMTPWorker[] = []

  constructor(
    config: ResolvedClientOptions,
  ) {
    for (let i = 0; i < config.pool!.size; i++) {
      this.pool.push(new SMTPWorker(config))
    }
  }

  #lastUsed = -1

  send(mail: ResolvedSendConfig) {
    this.#lastUsed = (this.#lastUsed + 1) % this.pool.length

    return this.pool[this.#lastUsed].send(mail)
  }

  close() {
    this.pool.forEach(v=>v.close())
  }
}

