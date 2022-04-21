/// <reference no-default-lib="true" />
/// <reference lib="deno.worker" />
/// <reference lib="deno.unstable" />

import { SmtpClient } from "./smtp.ts";
import { SendConfig } from "./config.ts";

const client = new SmtpClient({ console_debug: true });

let cb: () => void;
const readyPromise = new Promise<void>((res) => {
  cb = res;
});

let hasIdlePromise = false;

async function send(config: SendConfig) {
  client.send(config);

  if (!hasIdlePromise) {
    hasIdlePromise = true;
    await client.idle;
    postMessage(false);
    hasIdlePromise = false;
  }
}

addEventListener("message", async (ev: MessageEvent) => {
  if (ev.data.__setup) {
    await client.connectTLS(ev.data.__setup);
    cb();
    return;
  }
  if (ev.data.__check_idle) {
    postMessage(client.isSending);
    return;
  }
  await readyPromise;
  send(ev.data);
});
