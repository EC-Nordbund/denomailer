import { ConnectConfigWithAuthentication, SendConfig } from "./config.ts";

export class SMTPWorker {
  #timeout: number;

  constructor(
    config: ConnectConfigWithAuthentication,
    { timeout = 60000, autoconnect = true } = {},
  ) {
    this.#config = config;
    this.#timeout = timeout;
    if(autoconnect) {
      this.#startup();
    }
  }
  #w!: Worker;
  #idleTO: number | null = null;
  #idleMode2 = false;
  #noCon = true;
  #config: ConnectConfigWithAuthentication;

  #startup() {
    this.#w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
      deno: {
        permissions: {
          net: "inherit",
          // ts files
          read: true,
        },
        namespace: true,
      },
    });

    this.#w.addEventListener("message", (ev: MessageEvent<boolean>) => {
      if (ev.data) {
        this.#stopIdle();
      } else {
        if (this.#idleMode2) {
          this.#cleanup();
        } else {
          this.#startIdle();
        }
      }
    });

    this.#w.postMessage({
      __setup: this.#config,
    });

    this.#noCon = false;
  }

  #startIdle() {
    console.log("started idle");
    if (this.#idleTO) return;

    this.#idleTO = setTimeout(() => {
      console.log("idle mod 2");
      this.#idleMode2 = true;
      this.#w.postMessage({ __check_idle: true });
    }, this.#timeout);
  }

  #stopIdle() {
    if (this.#idleTO) clearTimeout(this.#idleTO);

    this.#idleMode2 = false;
    this.#idleTO = null;
  }

  #cleanup() {
    console.log("killed");
    this.#w.terminate();
    this.#stopIdle();
  }

  public send(mail: SendConfig) {
    this.#stopIdle();
    if (this.#noCon) {
      this.#startup();
    }
    this.#w.postMessage(mail);
  }
}

export class SMTPWorkerPool {
  pool: SMTPWorker[] = []

  constructor(
    config: ConnectConfigWithAuthentication,
    { timeout = 60000, size = 2 } = {}
  ) {
    for (let i = 0; i < size; i++) {
      this.pool.push(new SMTPWorker(config, {timeout, autoconnect: i === 0}))
    }
  }

  #lastUsed = -1

  send(mail: SendConfig) {
    this.#lastUsed = (this.#lastUsed + 1) % this.pool.length

    this.pool[this.#lastUsed].send(mail)
  }
}

