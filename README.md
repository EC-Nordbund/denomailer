# Denomailer a SMTP-client for Deno

> This was forked from https://github.com/manyuanrong/deno-smtp but now is much
> more advanced!

## Deno Deploy
If your SMTP server uses port 25, 465 or 587 you can't use denomailer with deno deploy. See https://discord.com/channels/684898665143206084/684911491035430919/961964433524031498 for more info.
> "You can not connect to SMTP servers on ports 25, 465, or 587 due to abuse."

## Quickstart with a simple example

```ts
// please use this line and change the version to the latest version!
// import { SMTPClient } from 'https://deno.land/x/denomailer@x.x.x/mod.ts'
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const client = new SMTPClient({
  connection: {
    hostname: "smtp.example.com",
    port: 465,
    tls: true,
    auth: {
      username: "example",
      password: "password",
    },
  },
});

await client.send({
  from: "me@example.com",
  to: "you@example.com",
  subject: "example",
  content: "...",
  html: "<p>...</p>",
});

await client.close();
```

## Client

You can create a new client with
`const client = new SMTPClient(/* client options */)`.

### Options

The only required option is `connection.hostname` but in most cases you want to
set `connection.,auth`.

Here are the full options available:

```ts
export interface ClientOptions {
  debug?: {
    /**
     * USE WITH COUTION AS THIS WILL LOG YOUR USERDATA AND ALL MAIL CONTENT TO STDOUT!
     * @default false
     */
    log?: boolean;
    /**
     * USE WITH COUTION AS THIS WILL POSIBLY EXPOSE YOUR USERDATA AND ALL MAIL CONTENT TO ATTACKERS!
     * @default false
     */
    allowUnsecure?: boolean;
    /**
     * USE WITH COUTION AS THIS COULD INTODRUCE BUGS
     *
     * This option is mainly to allow debuging to exclude some possible problem surfaces at encoding
     * @default false
     */
    encodeLB?: boolean;
    /**
     * Disable starttls
     */
    noStartTLS?: boolean;
  };
  connection: {
    hostname: string;
    /**
     * For TLS the default port is 465 else 25.
     * @default 25 or 465
     */
    port?: number;
    /**
     * authentication data
     */
    auth?: {
      username: string;
      password: string;
    };
    /**
     * Set this to `true` to connect via SSL / TLS if set to `false` STARTTLS is used.
     * Only if `allowUnsecure` is used userdata or mail content could be exposed!
     *
     * @default false
     */
    tls?: boolean;
  };
  /**
   * Create multiple connections so you can send emails faster!
   */
  pool?: {
    /**
     * Number of Workers
     * @default 2
     */
    size?: number;
    /**
     * Time the connection has to be idle to be closed. (in ms)
     * If a value > 1h is set it will be set to 1h
     * @default 60000
     */
    timeout?: number;
  } | boolean;
  client?: {
    /**
     * There are some cases where warnings are created. These are loged by default but you can 'ignore' them or all warnings should be considered 'error'.
     *
     * @default log
     */
    warning?: "ignore" | "log" | "error";
    /**
     * List of preproccessors to
     *
     * - Filter mail
     * - BCC all mails to someone
     * - ...
     */
    preprocessors?: Preprocessor[];
  };
}
```

#### connection

You have to set the hostname and in most cases you need the auth object as
(near) all SMTP-Server will require a login.

> The only usecase where you might not need it is if you connect to a server
> with IP protection so for example only local IP are allowed so a server
> application can send mails without login.

Denomailer supports 3 security modes:

1. TLS
2. STARTTLS
3. unsecure

You have to specify wich to use. As unsecure you have to set extra config
options in `debug` as it is not rcomended!

For TLS set `tls: true` for startTLS set `tls: false` (or don't set it).

#### client

There are some "problems" that can be warnings or errors. With the `warning`
option you censpecify if they should `'error'` or you can `'ignore'` them or
`'log'` them. Default is `'log'`. This includes filtering invalid emails and
custom preprocessors

With the `preprocessors` option you can add handlers that modify each
mail-config. For example you can add a filter so you don't send E-Mails to
burner mails etc.

A preprocessor is of the type:

```ts
type Preprocessor = (
  mail: ResolvedSendConfig,
  client: ResolvedClientOptions,
) => ResolvedSendConfig;
```

It gets a preproccesed E-Mail config (ResolvedSendConfig) and the preprocessed
client options (ResolvedClientOptions) and has to return a (maybe modified)
E-Mail config.

#### pool

With a normal SMTP-Client the E-Mails are send one after the other so if you
have a heavy load you might want to use more Clients at once for that we have a
pool option.

You can set the amount of clients used (`size`) and a timeout (in ms) after that
the connection is closed (`timeout`).

Note that for each connection we create a new Worker and the used worker syntax
requires (as of deno 1.21) to use the `--unstable` flag. Because of that this
API has to be considered unstable but we don't expect a change! (At least for
the public denomailer api internaly there might be some small changes that
require specific deno versions)

When you close the connection all worker are just killed.

#### debug

Sometimes you have specific needs for example we require encrypted connections
to send E-Mails and authentication. To enable unsecure connections set the
`allowUnsecure` option to `true` depending on your needs you have to disable
startTLS to get an unsecure connection use `noStartTLS` for this.

Note that we only use this in tests where the SMTP-Server is local and doesn't
support TLS.

If you want to get a full connection log use the `log` option. If you create an
issue for a bug please add the full log (but remove your authentication data
wich is encoded in base64).

In some cases you might get problems with Linebreaks in emails before creating
an issue please try `encodeLB: true` that changes the encoding a little and this
might solve your problem. Please create an issue if you need this option!

### Examples

```ts
const client = new SMTPClient({
  connection: {
    hostname: "smtp.example.com",
    port: 465,
    tls: true,
    auth: {
      username: "example",
      password: "password",
    },
  },
  pool: {
    size: 2,
    timeout: 60000,
  },
  client: {
    warning: "log",
    preprocessors: [filterBurnerMails],
  },
  debug: {
    log: false,
    allowUnsecure: false,
    encodeLB: false,
    noStartTLS: false,
  },
});
```

## Sending Mails

Just call `client.send(/* mail config */)`

### Config

The config you can set:

```ts
export interface SendConfig {
  to: mailList;
  cc?: mailList;
  bcc?: mailList;
  from: string;
  date?: string;
  subject: string;
  content?: string;
  mimeContent?: Content[];
  html?: string;
  inReplyTo?: string;
  replyTo?: string;
  references?: string;
  priority?: "high" | "normal" | "low";
  attachments?: Attachment[];
  /**
   * type of mail for example `registration` or `newsletter` etc.
   * allowes preprocessors to hande different email types
   */
  internalTag?: string | symbol;
}
```

All of it should be clear by name except:

#### mimeContent

There are use cases where you want to do encoding etc. on your own. This option
allowes you to specify the content of the mail.

#### content & html

The content should be a plain-text version of the html content you can set
`content` to `'auto'` to generate that by denomailer but in most cases you
should do it on your own!

#### attachments

A array of attachments you can encode it as base64, text, binary. Note that
base64 is converted to binary and only there for a better API. So don't encode
your binary files as base64 so denomailer can convert it back to binary.

#### internalTag

This can be used with preprocessors so you can give a mail a type for example
`'registration'`, `'newsletter'` etc. supports symbols and strings.

### Allowed Mail Formats

A single Mail `mail@example.de` with a name `NAME` can be encoded in the
following ways:

1. `"name@example.de"`
2. `"<name@example.de>"`
3. `"NAME <name@example.de>"`
4. `{mail: "name@example.de"}`
5. `{mail: "name@example.de", name: "NAME"}`

Multiple Mails can be an Array of the above OR a object that maps names to mails
for example:

`{"P1": "p1@example.de", "P2": "p2@example.de"}` we call this a MailObject.

For the fields

1. `from`, `replyTo` we only allow a single mail string.
2. `to`, `cc`, `bcc` we allow a MailObject a Array of single Mails (you can mix
   formats) or a single Mail.

### Examples

Example with near all options:

```ts
client.send({
  to: "abc@example.com",
  cc: [
    "abc@example.com",
    "abc <abc@example.com>",
    {
      name: "abc",
      mail: "abc@example.com",
    },
  ],
  bcc: {
    abc: "abc@example.com",
    other: "abc@example.com",
  },
  from: "me <abc@example.com>",
  replyTo: "<abc@example.com>",
  subject: "example",
  content: "auto",
  html: "<p>Hello World</p>",
  internalTag: "newsletter",
  priority: "low",
});
```

## Other exports

We export our implementation of an quotedPrintable encoder. There might be some
use cases where you need it. The api of the function is considered stable!

## Stable api

All api exported by `/mod.ts` is considered stable. But as the `pool` need the
`--unstable` flag by Deno this has to be considered unstable. But we don't
expect any breaking changes there - but if deno changes sytax etc. a new deno
release can break it!

Changes to them will only be made if a new major is released.

## Contribute

Feel free to contribute by:

1. creating issues for bugs and feature requests (note that you have to use the
   bug template to get support)
2. contribute code but keep in mind
   - for small changes you can just create a PR
   - for bigger changes please create an issue before! This will help to reduce
     time creating PR that are not merged.
   - if you fix a bug please add a test that fails before your fix
3. contribute tests, fix typos, ...

## TLS issues

When getting TLS errors make sure:

1. you use the correct port (mostly 25, 587, 465)
2. the server supports STARTTLS when using `connection.tls = false`
3. the server supports TLS when using `connection.tls = true`
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

## Non SpecCompliant SMTP-Server

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

## Breaking changes

### v0.x -> v1.0

1. Import `SMTPClient` not `SmtpClient`
2. Change the constructor options (include the options used with
   `client.connect` or `client.connectTLS` (add `tls = true` in the second
   case))
3. Remove `client.connect` and `client.connectTLS` calls
4. filterMail option was removed in favor of new preprocessor option
5. The `client.send` method did not have any breaking changes.
6. Some internal fields where removed from `SMTPClient` only use `send` and
   `close`! But in 99% of project these where not used
