import { clearEmails, getEmails } from "../fake-smtp.ts";
import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import { SMTPClient } from "../../mod.ts";

Deno.test("test simplest mail", async () => {
  await clearEmails();

  const client = new SMTPClient({
    debug: {
      allowUnsecure: true,
      log: true,
      noStartTLS: true,
    },
    connection: {
      hostname: "localhost",
      port: 1025,
      tls: false,
    },
  });

  await client.send({
    from: "me@denomailer.example",
    to: "you@denomailer.example",
    subject: "testing",
    content: "test",
  });

  const mails = await getEmails();
  assertEquals(mails.length, 1);
  await client.close();
});
