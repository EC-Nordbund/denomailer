# Denomailer a SMTP-client for Deno

> This was forked from https://github.com/manyuanrong/deno-smtp but now is much
> more advanced!

## Client

### Options

### Examples

## Sending Mails

### Options

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

1. `from`, `replyTo` we only allow a single mail.
2. `to`, `cc`, `bcc` we allow a MailObject a Array of single Mails or a single
   Mail.

### Examples

## Other exports

## Stable api

All api exported by `/mod.ts` is considered stable. But as the `pool` need the
`--unstable` flag by Deno this has to be considered unstable. But we don't
expect any breaking changes there.

Changes to them will only be made if a new major is released.

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
