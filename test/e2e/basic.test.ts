import { getEmails, clearEmails } from "../fake-smtp.ts";
import { assert } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import { SMTPClient } from "../../mod.ts";

Deno.test('test simplest mail', async () => {
  await clearEmails()

  const client = new SMTPClient({
    debug: {
      allowUnsecure: true,
      log: true
    },
    connection: {
      hostname: 'localhost',
      port: 1025
    }
  })

  await client.send({
    from: 'me@denomailer.example',
    to: 'you@denomailer.example',
    subject: 'testing',
    content: 'test'
  })

  const mails = await getEmails()
  assert(mails.length, 1)
})