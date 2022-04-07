import { CommandCode } from "./code.ts";
import type {
  ConnectConfig,
  ConnectConfigWithAuthentication,
  SendConfig,
} from "./config.ts";
import {
  normaliceMailList,
  normaliceMailString,
  validateConfig,
} from "./config.ts";
import { BufReader, BufWriter, TextProtoReader } from "./deps.ts";
import { base64Decode, quotedPrintableEncode } from "./encoding.ts";

const encoder = new TextEncoder();

interface Command {
  code: number;
  args: string;
}

interface SmtpClientOptions {
  throwOnEmailNotExisting?: boolean;
  console_debug?: boolean;
  unsecure?: boolean;
  mailFilter?: (box: string, domain: string, internalTag?: string | symbol | undefined) => (Promise<boolean>  | boolean)
}

export class SmtpClient {
  #secure = false;

  #conn: Deno.Conn | null = null;
  #reader: TextProtoReader | null = null;
  #writer: BufWriter | null = null;

  #console_debug = false;
  #allowUnsecure = false;
  #throwOnEmailNotExisting = false
  #mailFilter: SmtpClientOptions['mailFilter']

  constructor({
    console_debug = false,
    unsecure = false,
    throwOnEmailNotExisting = false,
    mailFilter
  }: SmtpClientOptions = {}) {
    this.#console_debug = console_debug;
    this.#allowUnsecure = unsecure;
    this.#mailFilter = mailFilter
    this.#throwOnEmailNotExisting = throwOnEmailNotExisting
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
    this.#secure = true;
    await this.#connect(conn, config);
  }

  async close() {
    if (!this.#conn) {
      return;
    }
    await this.#conn.close();
  }

  #currentlySending = false;
  #sending: (() => void)[] = [];

  #cueSending() {
    if (!this.#currentlySending) {
      this.#currentlySending = true;
      return;
    }

    return new Promise<void>((res) => {
      this.#sending.push(() => {
        this.#currentlySending = true;
        res();
      });
    });
  }

  #queNextSending() {
    if (this.#sending.length === 0) {
      this.#currentlySending = false;
      return;
    }

    const run = this.#sending[0];

    this.#sending.splice(0, 1);

    queueMicrotask(run);
  }

  async send(config: SendConfig) {
    const result = {
      emailsRemoved: {
        to: [],
        cc: [],
        bcc: []
      }
    }
    
    try {
      await this.#cueSending();

      validateConfig(config);

      const [from, fromData] = this.parseAddress(config.from);

      const to = config.to ? await this.filterMails(normaliceMailList(config.to).map((m) => this.parseAddress(m)), config.internalTag) : false;

      const cc = config.cc
        ? await this.filterMails(normaliceMailList(config.cc).map((v) => this.parseAddress(v)), config.internalTag)
        : false;

      const bcc =config.bcc ? await this.filterMails(normaliceMailList(config.bcc).map((v) =>
        this.parseAddress(v)
      ), config.internalTag) : false;

      if (config.replyTo) {
        config.replyTo = normaliceMailString(config.replyTo);

        const res = await this.filterMail([config.replyTo, config.replyTo], config.internalTag)

        if(!res) {
          throw new Error("ReplyTo Email is not vaild as the filter returned false")
        }
      }

      const date = config.date ??
        new Date().toUTCString().split(",")[1].slice(1);

      if (config.mimeContent && (config.html || config.content)) {
        throw new Error(
          "You should not use mimeContent together with html or content option!",
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
            content: quotedPrintableEncode(config.content),
            transferEncoding: "quoted-printable",
          });
        }

        if (config.html) {
          if (!config.content) {
            console.warn(
              "[SMTP] We highly recomand adding a plain text content in addition to your html content! You can set content to 'auto' to do this automaticly!",
            );
          }

          config.mimeContent.push({
            mimeType: 'text/html; charset="utf-8"',
            content: quotedPrintableEncode(config.html),
            transferEncoding: "quoted-printable",
          });
        }
      }

      if (config.mimeContent.length === 0) {
        throw new Error("No Content provided!");
      }

      await this.writeCmd("MAIL", "FROM:", from);
      this.assertCode(await this.readCmd(), CommandCode.OK);

      if(to) {
        for (let i = 0; i < to.length; i++) {
          await this.writeCmd("RCPT", "TO:", to[i][0]);
          const { code, args } = await this.readCmd()
          if(code === 550) {
            if(this.#throwOnEmailNotExisting) {
              throw new Error(code + ": " + args);
            }
            
            result.emailsRemoved.to.push(to[i])
            to.splice(i, 1)
            i--
          } else if (code !== 250) {
            throw new Error(code + ": " + args);
          }
        }
      }

      if (cc) {
        for (let i = 0; i < cc.length; i++) {
          await this.writeCmd("RCPT", "TO:", cc[i][0]);
          const { code, args } = await this.readCmd()
          if(code === 550) {
            if(this.#throwOnEmailNotExisting) {
              throw new Error(code + ": " + args);
            }
            
            result.emailsRemoved.cc.push(cc[i])
            cc.splice(i, 1)
            i--
          } else if (code !== 250) {
            throw new Error(code + ": " + args);
          }
        }
      }
      

      if (bcc) {
        for (let i = 0; i < bcc.length; i++) {
          await this.writeCmd("RCPT", "TO:", bcc[i][0]);
          const { code, args } = await this.readCmd()
          if(code === 550) {
            if(this.#throwOnEmailNotExisting) {
              throw new Error(code + ": " + args);
            }
            
            result.emailsRemoved.bcc.push(bcc[i])
            to.splice(i, 1)
            i--
          } else if (code !== 250) {
            throw new Error(code + ": " + args);
          }
        }
      }

      await this.writeCmd("DATA");
      this.assertCode(await this.readCmd(), CommandCode.BEGIN_DATA);

      await this.writeCmd("Subject: ", config.subject);
      await this.writeCmd("From: ", fromData);
      if(to) {
        await this.writeCmd("To: ", to.map((v) => v[1]).join(";"));
      }
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
        await this.writeCmd("ReplyTo: ", config.replyTo);
      }

      if (config.priority) {
        await this.writeCmd("Priority:", config.priority);
      }

      await this.writeCmd("MIME-Version: 1.0");

      await this.writeCmd(
        "Content-Type: multipart/mixed; boundary=attachment",
        "\r\n",
      );
      await this.writeCmd("--attachment");

      await this.writeCmd(
        "Content-Type: multipart/alternative; boundary=message",
        "\r\n",
      );

      for (let i = 0; i < config.mimeContent.length; i++) {
        await this.writeCmd("--message");
        await this.writeCmd(
          "Content-Type: " + config.mimeContent[i].mimeType,
        );
        if (config.mimeContent[i].transferEncoding) {
          await this.writeCmd(
            `Content-Transfer-Encoding: ${
              config.mimeContent[i].transferEncoding
            }` + "\r\n",
          );
        } else {
          // Send new line
          await this.writeCmd("");
        }

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
            "name=" + attachment.filename,
          );

          await this.writeCmd(
            "Content-Disposition: attachment; filename=" + attachment.filename,
            "\r\n",
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

      await this.writeCmd("--attachment--\r\n");

      await this.writeCmd(".\r\n");

      this.assertCode(await this.readCmd(), CommandCode.OK);
    } catch (ex) {
      await this.writeCmd("RSET")
      this.#queNextSending();
      throw ex;
    }

    this.#queNextSending();
    return result;
  }

  #supportedFeatures = new Set<string>()

  async #connect(conn: Deno.Conn, config: ConnectConfig) {
    this.#conn = conn;
    const reader = new BufReader(this.#conn);
    this.#writer = new BufWriter(this.#conn);
    this.#reader = new TextProtoReader(reader);

    this.assertCode(await this.readCmd(), CommandCode.READY);

    await this.writeCmd("EHLO", config.hostname);

    while (true) {
      const cmd = await this.readCmd();

      if(!cmd) break

      // Trim args
      const cleanCMD = cmd.args[0] === '-' ? cmd.args.slice(1) : cmd.args

      this.#supportedFeatures.add(cleanCMD)

      if(cmd.args[0] !== '-') break
    }

    if (this.#supportedFeatures.has('STARTTLS')) {
      await this.writeCmd("STARTTLS");
      this.assertCode(await this.readCmd(), CommandCode.READY);

      this.#conn = await Deno.startTls(this.#conn, {
        hostname: config.hostname,
      });

      this.#secure = true;

      const reader = new BufReader(this.#conn);
      this.#writer = new BufWriter(this.#conn);
      this.#reader = new TextProtoReader(reader);

      await this.writeCmd("EHLO", config.hostname);

      while (true) {
        const cmd = await this.readCmd();
        if (!cmd || !cmd.args.startsWith("-")) break;
      }
    }

    if (!this.#allowUnsecure && !this.#secure) {
      throw new Error(
        "Connection is not secure! Don't send authentication over non secure connection!",
      );
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

    if (this.#console_debug) {
      console.log(result);
    }

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
    config: ConnectConfig | ConnectConfigWithAuthentication,
  ): config is ConnectConfigWithAuthentication {
    return (config as ConnectConfigWithAuthentication).username !== undefined;
  }

  private parseAddress(
    email: string,
  ): [string, string] {
    if (email.includes("<")) {
      const m = email.split("<")[1].split(">")[0];
      return [`<${m}>`, email];
    } else {
      return [`<${email}>`, `<${email}>`];
    } 
  }

  private async filterMail([raw, _withName]: [string, string], internalTag: string | symbol | undefined): Promise<boolean> {
    if(!this.#mailFilter) return true
    
    const [box, domain] = raw.slice(1, raw.length - 1).split('@')

    const res = await this.#mailFilter!(box, domain, internalTag)

    return res
  }

  private async filterMails(mails: [string, string][], internalTag: string | symbol | undefined): Promise<[string, string][]> {
    if(!this.#mailFilter) return mails

    const keep = await Promise.all(mails.map(m => this.filterMail(m, internalTag)))

    return mails.filter((_, i) => keep[i])
  }
}
