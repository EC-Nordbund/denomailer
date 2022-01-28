import { CommandCode } from "./code.ts";
import type {
  ConnectConfig,
  ConnectConfigWithAuthentication,
  SendConfig,
  mailList,
  email,
  emailWithName,
  mailListObject,
  wrapedMail,
  mailString,
} from "./config.ts";
import { BufReader, BufWriter, TextProtoReader, base64Decode } from "./deps.ts";

const encoder = new TextEncoder();

interface Command {
  code: number;
  args: string;
}

enum ContentTransferEncoding {
  "7bit" = "7bit",
  "8bit" = "8bit",
  "base64" = "base64",
  "binary" = "binary",
  "quoted-printable" = "quoted-printable",
}

interface SmtpClientOptions {
  content_encoding?: "7bit" | "8bit" | "base64" | "binary" | "quoted-printable";
  console_debug?: boolean;
}

export class SmtpClient {
  #conn: Deno.Conn | null = null;
  #reader: TextProtoReader | null = null;
  #writer: BufWriter | null = null;

  #console_debug = false;
  #content_encoding: ContentTransferEncoding;

  constructor({
    content_encoding = ContentTransferEncoding["quoted-printable"],
    console_debug = false,
  }: SmtpClientOptions = {}) {
    this.#console_debug = console_debug;

    const _content_encoding = content_encoding.toLowerCase();

    if (!(_content_encoding in ContentTransferEncoding)) {
      throw new Error(
        `${JSON.stringify(content_encoding)} is not a valid content encoding`
      );
    }
    this.#content_encoding = _content_encoding as ContentTransferEncoding;
  }

  async connect(config: ConnectConfig | ConnectConfigWithAuthentication) {
    const conn = await Deno.connect({
      hostname: config.hostname,
      port: config.port || 25,
    });
    await this.#connect(conn, config);
  }

  async connectTLS(config: ConnectConfig | ConnectConfigWithAuthentication) {
    const conn = await Deno.connectTls({
      hostname: config.hostname,
      port: config.port || 465,
    });
    await this.#connect(conn, config);
  }

  async close() {
    if (!this.#conn) {
      return;
    }
    await this.#conn.close();
  }

  async send(config: SendConfig) {
    const [from, fromData] = this.parseAddress(config.from);

    const to = normaliceMailList(config.to).map((m) => this.parseAddress(m));

    const date = config.date ?? new Date().toUTCString().split(",")[1].slice(1);

    if (config.mimeContent && (config.html || config.content)) {
      throw new Error(
        "You should not use mimeContent together with html or content option!"
      );
    }

    if (!config.mimeContent) {
      config.mimeContent = [];

      // Allows to auto
      if (config.content === "auto" && config.html) {
        config.content = config.html
          .replace(/<head((.|\n|\r)*?)<\/head>/g, "")
          .replace(/<style((.|\n|\r)*?)<\/style>/g, "")
          .replace(/<[^>]+>/g, "");
      }

      if (config.content) {
        config.mimeContent.push({
          mimeType: 'text/plain; charset="utf-8"',
          content: config.content,
        });
      }

      if (config.html) {
        if (!config.content) {
          console.warn(
            "[SMTP] We highly recomand adding a plain text content in addition to your html content! You can set content to 'auto' to do this automaticly!"
          );
        }

        config.mimeContent.push({
          mimeType: 'text/html; charset="utf-8"',
          content: config.html,
        });
      }
    }

    if (config.mimeContent.length === 0) {
      throw new Error("No Content provided!");
    }

    await this.writeCmd("MAIL", "FROM:", from);
    this.assertCode(await this.readCmd(), CommandCode.OK);

    for (let i = 0; i < to.length; i++) {
      await this.writeCmd("RCPT", "TO:", to[i][0]);
      this.assertCode(await this.readCmd(), CommandCode.OK);
    }

    const cc = config.cc
      ? normaliceMailList(config.cc).map((v) => this.parseAddress(v))
      : false;

    if (cc) {
      console.log("cc");
      for (let i = 0; i < cc.length; i++) {
        await this.writeCmd("RCPT", "TO:", cc[i][0]);
        this.assertCode(await this.readCmd(), CommandCode.OK);
      }
    }

    if (config.bcc) {
      const bcc = normaliceMailList(config.bcc).map((v) =>
        this.parseAddress(v)
      );

      for (let i = 0; i < bcc.length; i++) {
        await this.writeCmd("RCPT", "TO:", bcc[i][0]);
        this.assertCode(await this.readCmd(), CommandCode.OK);
      }
    }

    await this.writeCmd("DATA");
    this.assertCode(await this.readCmd(), CommandCode.BEGIN_DATA);

    await this.writeCmd("Subject: ", config.subject);
    await this.writeCmd("From: ", fromData);
    await this.writeCmd("To: ", to.map((v) => v[1]).join(";"));
    if (cc) {
      await this.writeCmd("Cc: ", cc.map((v) => v[1]).join(";"));
    }
    await this.writeCmd("Date: ", date);

    if (config.inReplyTo) {
      await this.writeCmd("InReplyTo: ", config.inReplyTo);
    }

    if (config.references) {
      await this.writeCmd("Refrences: ", config.references);
    }

    if (config.replyTo) {
      config.replyTo = normaliceMailString(config.replyTo);

      await this.writeCmd("ReplyTo: ", config.replyTo);
    }

    if (config.priority) {
      await this.writeCmd("Priority:", config.priority);
    }

    await this.writeCmd("MIME-Version: 1.0");

    await this.writeCmd(
      "Content-Type: multipart/mixed; boundary=attachment",
      "\r\n"
    );
    await this.writeCmd("--attachment");

    await this.writeCmd(
      "Content-Type: multipart/alternative; boundary=message",
      "\r\n"
    );

    for (let i = 0; i < config.mimeContent.length; i++) {
      await this.writeCmd("--message");
      await this.writeCmd(
        "Content-Type: " + config.mimeContent[i].mimeType,
        "\r\n"
      );
      await this.writeCmd(config.mimeContent[i].content, "\r\n");
    }

    await this.writeCmd("--message--\r\n");

    if (config.attachments) {
      // Setup attachments
      for (let i = 0; i < config.attachments.length; i++) {
        const attachment = config.attachments[i];

        await this.writeCmd("--attachment");
        await this.writeCmd(
          "Content-Type:",
          attachment.contentType + ";",
          "name=" + attachment.filename
        );

        await this.writeCmd(
          "Content-Disposition: attachment; filename=" + attachment.filename,
          "\r\n"
        );

        if (attachment.encoding === "binary") {
          await this.writeCmd("Content-Transfer-Encoding: binary");

          if (
            attachment.content instanceof ArrayBuffer ||
            attachment.content instanceof SharedArrayBuffer
          ) {
            await this.writeCmdBinary(new Uint8Array(attachment.content));
          } else {
            await this.writeCmdBinary(attachment.content);
          }

          await this.writeCmd("\r\n");
        } else if (attachment.encoding === "text") {
          await this.writeCmd("Content-Transfer-Encoding: quoted-printable");

          await this.writeCmd(attachment.content, "\r\n");
        } else if (attachment.encoding === "base64") {
          await this.writeCmd("Content-Transfer-Encoding: binary");
          await this.writeCmdBinary(base64Decode(attachment.content));
          await this.writeCmd();
        }
      }
    }

    // TODO: add attachments

    await this.writeCmd("--attachment--\r\n");

    await this.writeCmd(".\r\n");

    this.assertCode(await this.readCmd(), CommandCode.OK);
  }

  async #connect(conn: Deno.Conn, config: ConnectConfig) {
    this.#conn = conn;
    const reader = new BufReader(this.#conn);
    this.#writer = new BufWriter(this.#conn);
    this.#reader = new TextProtoReader(reader);

    this.assertCode(await this.readCmd(), CommandCode.READY);

    await this.writeCmd("EHLO", config.hostname);

    let startTLS = false;

    while (true) {
      const cmd = await this.readCmd();
      if (!cmd || !cmd.args.startsWith("-")) break;
      if (cmd.args == "-STARTTLS") startTLS = true;
    }

    if (startTLS) {
      await this.writeCmd("STARTTLS");
      this.assertCode(await this.readCmd(), CommandCode.READY);

      this.#conn = await Deno.startTls(this.#conn, {
        hostname: config.hostname,
      });

      const reader = new BufReader(this.#conn);
      this.#writer = new BufWriter(this.#conn);
      this.#reader = new TextProtoReader(reader);

      await this.writeCmd("EHLO", config.hostname);

      while (true) {
        const cmd = await this.readCmd();
        if (!cmd || !cmd.args.startsWith("-")) break;
      }
    }

    if (this.useAuthentication(config)) {
      await this.writeCmd("AUTH", "LOGIN");
      this.assertCode(await this.readCmd(), 334);

      await this.writeCmd(btoa(config.username));
      this.assertCode(await this.readCmd(), 334);

      await this.writeCmd(btoa(config.password));
      this.assertCode(await this.readCmd(), CommandCode.AUTHO_SUCCESS);
    }
  }

  private assertCode(cmd: Command | null, code: number, msg?: string) {
    if (!cmd) {
      throw new Error(`invalid cmd`);
    }
    if (cmd.code !== code) {
      throw new Error(msg || cmd.code + ": " + cmd.args);
    }
  }

  private async readCmd(): Promise<Command | null> {
    if (!this.#reader) {
      return null;
    }
    const result = await this.#reader.readLine();
    if (result === null) return null;
    const cmdCode = parseInt(result.slice(0, 3).trim());
    const cmdArgs = result.slice(3).trim();
    return {
      code: cmdCode,
      args: cmdArgs,
    };
  }

  private async writeCmd(...args: string[]) {
    if (!this.#writer) {
      return null;
    }

    if (this.#console_debug) {
      console.table(args);
    }

    const data = encoder.encode([...args].join(" ") + "\r\n");
    await this.#writer.write(data);
    await this.#writer.flush();
  }

  private async writeCmdBinary(...args: Uint8Array[]) {
    if (!this.#writer) {
      return null;
    }

    if (this.#console_debug) {
      console.table(args.map(() => "Uint8Attay"));
    }

    for (let i = 0; i < args.length; i++) {
      await this.#writer.write(args[i]);
    }
    await this.#writer.flush();
  }

  private useAuthentication(
    config: ConnectConfig | ConnectConfigWithAuthentication
  ): config is ConnectConfigWithAuthentication {
    return (config as ConnectConfigWithAuthentication).username !== undefined;
  }

  private parseAddress(
    email: string
  ): [wrapedMail, emailWithName | wrapedMail] {
    if (email.includes("<")) {
      const m = email.split("<")[1].split(">")[0];
      return [`<${m}>` as wrapedMail, email as emailWithName | wrapedMail];
    } else {
      return [`<${email}>` as wrapedMail, `<${email}>` as wrapedMail];
    }
  }
}

function normaliceMailString(mail: mailString) {
  if (mail.includes("<")) {
    return mail as emailWithName;
  } else {
    return `<${mail}>` as wrapedMail;
  }
}

function normaliceMailList(
  mails?: mailList | null
): (emailWithName | wrapedMail)[] {
  if (!mails) return [];

  if (typeof mails === "string") {
    return [normaliceMailString(mails)];
  } else if (Array.isArray(mails)) {
    return mails.map((m) => {
      if (typeof m === "string") {
        if (m.includes("<")) {
          return m as emailWithName;
        } else {
          return `<${m}>` as emailWithName;
        }
      } else {
        return m.name
          ? (`${m.name} <${m.mail}>` as emailWithName)
          : (`<${m.mail}>` as emailWithName);
      }
    });
  } else if (mails.mail) {
    return [
      mails.name
        ? (`${mails.name} <${mails.mail}>` as emailWithName)
        : (`<${mails.mail}>` as emailWithName),
    ];
  } else {
    return Object.entries(mails as mailListObject).map(
      ([name, mail]: [string, email]) => `${name} <${mail}>` as emailWithName
    );
  }
}
