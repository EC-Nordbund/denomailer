## Deno SMTP mail client

### IMPORTANT SECURITY INFORMATION

PLEASE update to a version >= 0.8! 0.8 has a problem where malformed mails could
potentialy allow attackers to create a mail (with linebreaks) to send unwanted
SMTP commands. This could result in authentic phishing attacks! With no way for
the user to identify that this is a phishing mail! Or that this mail contains a
dangerous attachment!

Also make sure that Mails are sent one after the other as they can corrupt each
others data!

### Allowed Mail Formats

A single Mail `mail@example.de` with a name `NAME` can be encoded in the
following ways:

1. `"name@example.de"`
2. `"<name@example.de>"`
3. `"NAME <name@example.de>"`
4. `{mail: "name@example.de"}`
5. `{mail: "name@example.de", name: "NAME"}`

Where 1-3 is called a "MailString".

Multiple Mails can be an Array of the above OR a object that maps names to mails
for example:

`{"P1": "p1@example.de", "P2": "p2@example.de"}` we call this a MailObject.

For the fields

1. `from`, `replyTo` we only allow a "MailString".
2. `to`, `cc`, `bcc` we allow a MailObject a Array of single Mails or a single
   Mail.

### Sending multiple mails

Note that for race-condition reasons we can't send multiple mails at once.
Because of that if send is already called and still processing a mail
`client.send` will queue that sending.

### Example

```ts
import { SmtpClient, quotedPrintableEncode } from "https://deno.land/x/denomailer/mod.ts";

const client = new SmtpClient();

await client.connect({
  hostname: "smtp.163.com",
  port: 25,
  username: "username",
  password: "password",
});

await client.send({
  from: "mailaddress@163.com",
  to: "Me <to-address@xx.com>",
  cc: [
    "name@example.de",
    "<name@example.de>",
    "NAME <name@example.de>",
    {mail: "name@example.de"},
    {mail: "name@example.de", name: "NAME"}
  ],
  bcc: {
    "Me": "to-address@xx.com"
  },
  subject: "Mail Title",
  content: "Mail Content",
  html: "<a href='https://github.com'>Github</a>",
  date: "12 Mar 2022 10:38:05 GMT",
  priority: "high",
  replyTo: 'mailaddress@163.com',
  attachments: [
    { encoding: "text"; content: 'Hi', contentType: 'text/plain', filename: 'text.txt' },
    { encoding: "base64"; content: '45dasjZ==', contentType: 'image/png', filename: 'img.png' },
    {
      content: new Uint8Array([0,244,123]),
      encoding: "binary",
      contentType: 'image/jpeg', 
      filename: 'bin.png'
    }
  ],
  mimeContent: [
    {
      mimeType: 'application/markdown',
      content: quotedPrintableEncode('# Title\n\nHello World!'),
      transferEncoding: 'quoted-printable'
    }
  ]
  
});

await client.close();
```

#### TLS connection

```ts
await client.connect({
  hostname: "smtp.163.com",
  tls: true,
  port: 465,
  username: "username",
  password: "password",
});
```

#### Use in Gmail

```ts
await client.connect({
  tls: true,
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

### Filter E-Mails

If you want a custom E-Mail validator and filter some E-Mails (because they are
burner mails or the domain is on a blacklist or only allow specific domains
etc.) you can add the `mailFilter` option to the smtp-client constructor
options. `mailFilter` takes a function that gets 3 Arguments the "mailbox" (all
that is before @ in the mail), the "domain" (what is after the @) and
`internalTag` that is a new option that can be set in the mailConfig so you can
set a type for that mail for example type `newsletter` etc. `internalTag` can be
a `string` or a `symbol`.

The filter function returns a boolean or a Promise that resolves to a boolean.
There are 3 things you can do when this function is called:

1. return `true` the E-Mail is keept in the list
2. return `false` the E-Mail is removed from the list
3. throw an Error the E-Mail is aborted and never send

So you can decide if a single mail error results in a complete mail abort or it
only get removed from the list.

You can for example validate against this list:
https://github.com/wesbos/burner-email-providers.

### Configuring your client

You can pass options to your client through the `SmtpClient` constructor.

```ts
import { SmtpClient } from "https://deno.land/x/denomailer/mod.ts";

//Defaults
const client = new SmtpClient({
  console_debug: true, // enable debugging this is good while developing should be false in production as Authentication IS LOGGED TO CONSOLE!
  unsecure: true, // allow unsecure connection to send authentication IN PLAIN TEXT and also mail content!
});
```

## Pool, Worker

> This is unstable API may change! This requires deno to run in unstable mode.

Adds 2 new classes `SMTPWorker` and `SMTPWorkerPool` (for constructor options
see code for now). This creates a SMTP client (or multiple) that get automaticly
killed if the connection is not used for around 60s.

## TLS issues

When getting TLS errors make shure:

1. you use the correct port (mostly 25, 587, 465)
2. the server supports STARTTLS when using `client.connect`
3. the server supports TLS when using `client.connectTLS`
4. Use the command
   `openssl s_client -debug -starttls smtp -crlf -connect your-host.de:587` or
   `openssl s_client -debug -crlf -connect your-host.de:587` and get the used
   cipher this should be a cipher with "forward secrecy". Check the status of
   the cipher on https://ciphersuite.info/cs/ . If the cipher is not STRONG this
   is an issue with your mail provider so you have to contact them to fix it.
5. Feel free to create issues if you are ok with that share the port and host so
   a proper debug can be done.
6. We can only support TLS where Deno supports it and Deno uses rustls wich
   explicitly not implemented some "weak" ciphers.

### Non SpecCompliant SMTP-Server

There are some SMTP-Server that don't follow the spec to 100%. This can result
in unexpected errors in denomailer. If this happens (for example in
https://github.com/EC-Nordbund/denomailer/blob/03a66a6f9a4b5f349ea35856f5903fb45fd0cc5f/smtp.ts#L376
the server sends a 250) please create an issue. We will try and do the
following:

1. Check if it is not an error in denomailer
2. Try to fix it at the SMTP-Server side (create an issue if the server is an
   opensource project etc.)
3. We will add a _**temporary**_ workaround by changing denomailer. This will
   include log messages telling the developer (if the workaround is used) that
   denomailer used the workaround wich can be removed at any time.
