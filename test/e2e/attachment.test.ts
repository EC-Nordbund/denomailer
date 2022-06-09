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

  const content = "A\r\nHello\nWorld\rjmjkjj";

  await client.send({
    from: "me@denomailer.example",
    to: "you@denomailer.example",
    subject: "testing",
    content: "test",
    attachments: [
      {
        content,
        filename: "text.txt",
        encoding: "text",
        contentType: "text/plain",
      },
    ],
  });

  const mails = await getEmails();
  const data = new Uint8Array(mails[0].attachments[0].content.data);
  assertEquals(new TextDecoder().decode(data).trim(), content.trim());
  await client.close();
});

Deno.test("test binary attachment", async () => {
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

  const content = await Deno.readFile(
    Deno.cwd() + "/test/e2e/attachments/image.png",
  );

  await client.send({
    from: "me@denomailer.example",
    to: "you@denomailer.example",
    subject: "testing",
    content: "test",
    attachments: [
      {
        content,
        filename: "text.txt",
        encoding: "binary",
        contentType: "image/png",
      },
    ],
  });

  await wait(2000);

  const mails = await getEmails();
  const data = new Uint8Array(mails[0].attachments[0].content.data);
  assertEquals(data, content);
  await client.close();
});

Deno.test("test more text attachment", async () => {
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

  const content = [
    "abc\ndef\nghi",
    "abc\rdef\rghi",
    "abc\ndef\rghi",
    "abc\rdef\ndhi",
  ];

  for (let i = 0; i < content.length; i++) {
    await client.send({
      from: "me@denomailer.example",
      to: "you@denomailer.example",
      subject: "testing",
      content: "test",
      attachments: [
        {
          content: content[i],
          filename: "text.txt",
          encoding: "text",
          contentType: "text/plain",
        },
      ],
    });

    const mails = await getEmails();
    const data = new Uint8Array(mails[0].attachments[0].content.data);
    assertEquals(new TextDecoder().decode(data).trim(), content[i].trim());
  }
  await client.close();
});
