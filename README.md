## Deno SMTP mail client

> This is a WIP fork of the (dead?) https://github.com/manyuanrong/deno-smtp to enable better mail sending!

The following additional API are added / planed:

- [x] to multiple mails
- [x] cc and bcc
- [x] STARTTLS (Thanks to @dbellingroth)
- [x] Attachments
- [x] replyTo
- [x] rewrite content with more options
- [x] priority
- [x] mail validation to avoid abuse to spam!
- [ ] fix race condition
- [ ] encoding tests (äöß,...) pending attachments


Allowed SingleMailFormat:
```txt
name@example.de
<name@example.de>
NAME <name@example.de>
{mail: "name@example.de"}
{mail: "name@example.de", name: "NAME"}
```

For to, cc, bcc you can provide one of the above OR a array of the above OR a object: {"NAME": "name@example.de"} where the name maps to the mail.

### IMPORTANT SECURITY INFORMATION
PLEASE update to a version >= 0.8! 0.8 has a problem where malformed mails could potatialy allow attackers to create a mail (with linebreaks) to send unwanted SMTP commands. This could result in authentic phishing attacks! Whith no way for the user to identify that this is a phishing mail! Or that this mail contains a dangorus attachment!

Also make shure that Mails are sent one after the other as they can corrupt each others data!


<!-- We use the following regex to validate a single email: `/([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)/` -->

<!-- [![Build Status](https://github.com/manyuanrong/deno-smtp/workflows/ci/badge.svg?branch=master)](https://github.com/manyuanrong/deno-smtp/actions)
![GitHub](https://img.shields.io/github/license/manyuanrong/deno-smtp.svg)
![GitHub release](https://img.shields.io/github/release/manyuanrong/deno-smtp.svg)
![(Deno)](https://img.shields.io/badge/deno-1.0.0-green.svg) -->

### Example

```ts
import { SmtpClient } from "https://deno.land/x/denomailer/mod.ts";

const client = new SmtpClient();

await client.connect({
  hostname: "smtp.163.com",
  port: 25,
  username: "username",
  password: "password",
});

await client.send({
  from: "mailaddress@163.com",
  to: "to-address@xx.com",
  subject: "Mail Title",
  content: "Mail Content",
  html: "<a href='https://github.com'>Github</a>",
});

await client.close();
```

#### TLS connection

```ts
await client.connectTLS({
  hostname: "smtp.163.com",
  port: 465,
  username: "username",
  password: "password",
});
```

#### Use in Gmail

```ts
await client.connectTLS({
  hostname: "smtp.gmail.com",
  port: 465,
  username: "your username",
  password: "your password",
});

await client.send({
  from: "someone@163.com", // Your Email address
  to: "someone@xx.com", // Email address of the destination
  subject: "Mail Title",
  content: "Mail Content，maybe HTML",
});

await client.close();
```

### Configuring your client

You can pass options to your client through the `SmtpClient` constructor.

As in https://deno.land/x/smtp this options currently doesn't do anything!

```ts
import { SmtpClient } from "https://deno.land/x/denomailer/mod.ts";

//Defaults
const client = new SmtpClient({
  content_encoding: "quoted-printable", // 7bit, 8bit, base64, binary, quoted-printable
});
```
