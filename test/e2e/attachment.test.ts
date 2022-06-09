import { clearEmails, getEmails } from "../fake-smtp.ts";
import { assertEquals } from "https://deno.land/std@0.136.0/testing/asserts.ts";
import { SMTPClient } from "../../mod.ts";

function wait(to = 10000) {
  return new Promise((res) => setTimeout(res, to));
}

Deno.test("test text attachment", async () => {
  await clearEmails();

  const client = new SMTPClient({
    debug: {
      allowUnsecure: true,
      // log: true,
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
    attachments: [
      {
        content: "Hello\rWorld!",
        filename: "text.txt",
      },
    ],
  });

  const mails = await getEmails();
  console.log(mails[0].attachments);
  assertEquals(mails.length, 1);
  await client.close();
});

// Deno.test("test simplest mail with pool", async () => {
//   await clearEmails();

//   const client = new SMTPClient({
//     debug: {
//       allowUnsecure: true,
//       // log: true,
//       noStartTLS: true,
//     },
//     connection: {
//       hostname: "localhost",
//       port: 1025,
//       tls: false,
//     },
//     pool: true,
//   });

//   await client.send({
//     from: "me@denomailer.example",
//     to: "you@denomailer.example",
//     subject: "testing",
//     content: "test",
//   });

//   await wait(2000);

//   const mails = await getEmails();
//   assertEquals(mails.length, 1);
//   await client.close();
// });

// Deno.test("test subject", async () => {
//   await clearEmails();

//   const client = new SMTPClient({
//     debug: {
//       allowUnsecure: true,
//       // log: true,
//       noStartTLS: true,
//     },
//     connection: {
//       hostname: "localhost",
//       port: 1025,
//       tls: false,
//     },
//   });

//   const subject = Math.random().toString();

//   await client.send({
//     from: "me@denomailer.example",
//     to: "you@denomailer.example",
//     subject,
//     content: "test",
//   });

//   await wait(2000);

//   const mails = await getEmails();
//   assertEquals(mails.length, 1);
//   assertEquals(mails[0].subject, subject);
//   await client.close();
// });

// Deno.test("test html", async () => {
//   await clearEmails();

//   const client = new SMTPClient({
//     debug: {
//       allowUnsecure: true,
//       // log: true,
//       noStartTLS: true,
//     },
//     connection: {
//       hostname: "localhost",
//       port: 1025,
//       tls: false,
//     },
//   });

//   const testSet = [
//     "<p>asdjhhj</p>",
//     "<p>kljfskjlsfs",
//     "</p>dkjasjd<p>",
//     // TODO add some long testsets with linebreaks etc.
//   ];

//   for (const html of testSet) {
//     await clearEmails();
//     await client.send({
//       from: "me@denomailer.example",
//       to: "you@denomailer.example",
//       subject: "testing",
//       content: "test",
//       html,
//     });

//     const mails = await getEmails();
//     assertEquals(mails.length, 1);
//     assertEquals(mails[0].html.toString().trim(), html);
//   }
//   await client.close();
// });
