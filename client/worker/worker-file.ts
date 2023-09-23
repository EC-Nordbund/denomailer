/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />
/// <reference lib="deno.unstable" />

import { SMTPClient } from "../basic/client.ts";
import { ResolvedSendConfig } from "../../config/mail/mod.ts";
import type { Message } from "./worker.ts";

let client: SMTPClient;

let cb: () => void;
const readyPromise = new Promise<void>((res) => {
  cb = res;
});

let hasIdlePromise = false;

async function send(config: ResolvedSendConfig) {
  client.send(config);

  if (!hasIdlePromise) {
    hasIdlePromise = true;
    await client.idle;
    postMessage(false);
    hasIdlePromise = false;
  }
}

const doPostMessage = (message: Message): ReturnType<typeof postMessage> =>
  postMessage(message);

addEventListener("message", async (ev: MessageEvent) => {
  if (ev.data.__setup) {
    client = new SMTPClient(ev.data.__setup);
    cb();
    return;
  }
  if (ev.data.__check_idle) {
    doPostMessage(client.isSending);
    return;
  }

  if (ev.data.__mail) {
    await readyPromise;
    try {
      const data = await send(ev.data.mail);
      doPostMessage({
        __ret: ev.data.__mail,
        res: data,
      });
    } catch (ex) {
      doPostMessage({
        __ret: ev.data.__mail,
        err: ex,
      });
    }
  }
});
