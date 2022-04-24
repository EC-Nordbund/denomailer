import type { ResolvedSendConfig } from "../config/mail/mod.ts";
import { BufReader, BufWriter, TextProtoReader } from "../deps.ts";
import { ResolvedClientOptions } from '../config/client/mod.ts'

const CommandCode = {
  READY: 220,
  AUTHO_SUCCESS: 235,
  OK: 250,
  BEGIN_DATA: 354,
  FAIL: 554,
};


const encoder = new TextEncoder();

interface Command {
  code: number;
  args: string;
}

export class SmtpClient {
  #secure = false;

  #conn: Deno.Conn | null = null;
  #reader: TextProtoReader | null = null;
  #writer: BufWriter | null = null;

  constructor(private config: ResolvedClientOptions) {
    this.#ready = this.connect()
  }

  #ready: Promise<void>

  async connect() {
    if(this.config.connection.tls) {
      const conn = await Deno.connectTls({
        hostname: this.config.connection.hostname,
        port: this.config.connection.port
      });
      this.#secure = true;
      await this.#connect(conn);
    } else {
      const conn = await Deno.connect({
        hostname: this.config.connection.hostname,
        port: this.config.connection.port
      });
      await this.#connect(conn);
    }
  }

  async close() {
    if (!this.#conn) {
      return;
    }
    await this.#conn.close();
  }

  get isSending() {
    return this.#currentlySending
  }

  get idle() {
    return this.#idlePromise
  }

  #idlePromise = Promise.resolve()
  #idleCB = () => {}

  // #encodeLB = false

  #currentlySending = false;
  #sending: (() => void)[] = [];

  #cueSending() {
    if (!this.#currentlySending) {
      this.#idlePromise = new Promise((res) => {
        this.#idleCB = res
      })
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
      this.#idleCB()
      return;
    }

    const run = this.#sending[0];

    this.#sending.splice(0, 1);

    queueMicrotask(run);
  }

  async send(config: ResolvedSendConfig) {
    await this.#ready
    try {
      await this.#cueSending();

      await this.writeCmd("MAIL", "FROM:", `<${config.from.mail}>`);
      this.assertCode(await this.readCmd(), CommandCode.OK);

      for (let i = 0; i < config.to.length; i++) {
        await this.writeCmd("RCPT", "TO:", `<${config.to[i].mail}>`);
        this.assertCode(await this.readCmd(), CommandCode.OK);
      }

      for (let i = 0; i < config.cc.length; i++) {
        await this.writeCmd("RCPT", "TO:", `<${config.cc[i].mail}>`);
        this.assertCode(await this.readCmd(), CommandCode.OK);
      }

      for (let i = 0; i < config.bcc.length; i++) {
        await this.writeCmd("RCPT", "TO:", `<${config.bcc[i].mail}>`);
        this.assertCode(await this.readCmd(), CommandCode.OK);
      }

      await this.writeCmd("DATA");
      this.assertCode(await this.readCmd(), CommandCode.BEGIN_DATA);

      await this.writeCmd("Subject: ", config.subject);
      await this.writeCmd("From: ", `${config.from.name} <${config.from.mail}>`);
      if(config.to.length > 0){
        await this.writeCmd("To: ", config.to.map((m) => `${m.name} <${m.mail}>`).join(";"));
      }
      if(config.cc.length > 0){
        await this.writeCmd("Cc: ", config.cc.map((m) => `${m.name} <${m.mail}>`).join(";"));
      }
      
      await this.writeCmd("Date: ", config.date);

      if (config.inReplyTo) {
        await this.writeCmd("InReplyTo: ", config.inReplyTo);
      }

      if (config.references) {
        await this.writeCmd("Refrences: ", config.references);
      }

      if (config.replyTo) {
        await this.writeCmd("ReplyTo: ", `${config.replyTo.name} <${config.replyTo.name}>`);
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
        }
      }

      await this.writeCmd("--attachment--\r\n");

      await this.writeCmd(".\r\n");

      this.assertCode(await this.readCmd(), CommandCode.OK);
    } catch (ex) {
      this.#queNextSending();
      throw ex;
    }
    await this.#cleanup()
    this.#queNextSending();
  }

  #supportedFeatures = new Set<string>()
  #_reader?: BufReader

  async #cleanup() {
    this.writeCmd('NOOP')

    while (true) {
      const cmd = await this.readCmd()
      if(cmd && cmd.code === 250) return
    }
  }

  async #connect(conn: Deno.Conn) {
    this.#conn = conn;
    this.#_reader = new BufReader(this.#conn);
    this.#writer = new BufWriter(this.#conn);
    this.#reader = new TextProtoReader(this.#_reader);

    this.assertCode(await this.readCmd(), CommandCode.READY);

    await this.writeCmd("EHLO", this.config.connection.hostname);

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
        hostname: this.config.connection.hostname,
      });

      this.#secure = true;

      this.#_reader = new BufReader(this.#conn);
      this.#writer = new BufWriter(this.#conn);
      this.#reader = new TextProtoReader(this.#_reader);

      await this.writeCmd("EHLO", this.config.connection.hostname);

      while (true) {
        const cmd = await this.readCmd();
        if (!cmd || !cmd.args.startsWith("-")) break;
      }
    }

    if (!this.config.debug.allowUnsecure && !this.#secure) {
      throw new Error(
        "Connection is not secure! Don't send authentication over non secure connection!",
      );
    }

    if (this.config.connection.auth) {
      await this.writeCmd("AUTH", "LOGIN");
      this.assertCode(await this.readCmd(), 334);

      await this.writeCmd(btoa(this.config.connection.auth.username));
      this.assertCode(await this.readCmd(), 334);

      await this.writeCmd(btoa(this.config.connection.auth.password));
      this.assertCode(await this.readCmd(), CommandCode.AUTHO_SUCCESS);
    }

    await this.#cleanup()
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

    if (this.config.debug.log) {
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

    if (this.config.debug.log) {
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

    if (this.config.debug.log) {
      console.table(args.map(() => "Uint8Attay"));
    }

    for (let i = 0; i < args.length; i++) {
      await this.#writer.write(args[i]);
    }
    await this.#writer.flush();
  }

}
