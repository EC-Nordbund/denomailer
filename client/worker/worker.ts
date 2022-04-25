import { ResolvedSendConfig } from "../../config/mail/mod.ts";
import { ResolvedClientOptions } from "../../config/client.ts";

export class SMTPWorker {
  id = 1;
  #timeout: number;

  constructor(
    config: ResolvedClientOptions,
  ) {
    this.#config = config;
    this.#timeout = config.pool!.timeout;
  }
  #w!: Worker;
  #idleTO: number | null = null;
  #idleMode2 = false;
  #noCon = true;
  #config: ResolvedClientOptions;

  #resolver = new Map<
    number,
    // deno-lint-ignore no-explicit-any
    { res: (res: any) => void; rej: (err: Error) => void }
  >();

  #startup() {
    this.#w = new Worker(new URL("./worker-file.ts", import.meta.url), {
      type: "module",
      deno: {
        permissions: {
          net: "inherit",
          // ts files
          read: true,
        },
        namespace: true,
      },
      // This allowes the deno option so only for pool and worker we need --unstable
      // deno-lint-ignore no-explicit-any
    } as any);

    this.#w.addEventListener(
      "message",
      // deno-lint-ignore no-explicit-any
      (ev: MessageEvent<boolean | { __ret: number; res: any; err: any }>) => {
        if (typeof ev.data === "object") {
          if ("err" in ev.data) {
            this.#resolver.get(ev.data.__ret)?.rej(ev.data.err);
          }

          if ("res" in ev.data) {
            this.#resolver.get(ev.data.__ret)?.res(ev.data.res);
          }

          this.#resolver.delete(ev.data.__ret);
          return;
        }

        if (ev.data) {
          this.#stopIdle();
        } else {
          if (this.#idleMode2) {
            this.#cleanup();
          } else {
            this.#startIdle();
          }
        }
      },
    );

    this.#w.postMessage({
      __setup: {
        ...this.#config,
        client: {
          ...this.#config.client,
          preprocessors: [],
        },
      },
    });

    this.#noCon = false;
  }

  #startIdle() {
    console.log("started idle");
    if (this.#idleTO) {
      return;
    }

    this.#idleTO = setTimeout(() => {
      console.log("idle mod 2");
      this.#idleMode2 = true;
      this.#w.postMessage({ __check_idle: true });
    }, this.#timeout);
  }

  #stopIdle() {
    if (this.#idleTO) {
      clearTimeout(this.#idleTO);
    }

    this.#idleMode2 = false;
    this.#idleTO = null;
  }

  #cleanup() {
    console.log("killed");
    this.#w.terminate();
    this.#stopIdle();
  }

  public send(mail: ResolvedSendConfig) {
    const myID = this.id;
    this.id++;
    this.#stopIdle();
    if (this.#noCon) {
      this.#startup();
    }
    this.#w.postMessage({
      __mail: myID,
      mail,
    });

    return new Promise<void>((res, rej) => {
      this.#resolver.set(myID, { res, rej });
    });
  }

  close() {
    if (this.#w) this.#w.terminate();
    if (this.#idleTO) {
      clearTimeout(this.#idleTO);
    }
  }
}
