import type { ResolvedSendConfig } from "../../config/mail/mod.ts";
import { ResolvedClientOptions } from "../../config/client.ts";
import { SMTPConnection } from "./connection.ts";

const CommandCode = {
  READY: 220,
  AUTHO_SUCCESS: 235,
  OK: 250,
  BEGIN_DATA: 354,
  FAIL: 554,
};

class QUE {
  running = false;
  #que: (() => void)[] = [];
  idle: Promise<void> = Promise.resolve();
  #idbleCB?: () => void;

  que(): Promise<void> {
    if (!this.running) {
      this.running = true;
      this.idle = new Promise((res) => {
        this.#idbleCB = res;
      });
      return Promise.resolve();
    }

    return new Promise<void>((res) => {
      this.#que.push(res);
    });
  }

  next() {
    if (this.#que.length === 0) {
      this.running = false;
      if (this.#idbleCB) this.#idbleCB();
      return;
    }

    this.#que[0]();
    this.#que.splice(0, 1);
  }
}

export class SMTPClient {
  #connection: SMTPConnection;
  #que = new QUE();

  constructor(private config: ResolvedClientOptions) {
    const c = new SMTPConnection(config);
    this.#connection = c;

    this.#ready = (async () => {
      await c.ready;
      await this.#prepareConnection();
    })();
  }

  #ready: Promise<void>;

  close() {
    return this.#connection.close();
  }

  get isSending() {
    return this.#que.running;
  }

  get idle() {
    return this.#que.idle;
  }

  async send(config: ResolvedSendConfig) {
    await this.#ready;
    try {
      await this.#que.que();

      await this.#connection.writeCmd("MAIL", "FROM:", `<${config.from.mail}>`);
      this.#connection.assertCode(
        await this.#connection.readCmd(),
        CommandCode.OK,
      );

      for (let i = 0; i < config.to.length; i++) {
        await this.#connection.writeCmd(
          "RCPT",
          "TO:",
          `<${config.to[i].mail}>`,
        );
        this.#connection.assertCode(
          await this.#connection.readCmd(),
          CommandCode.OK,
        );
      }

      for (let i = 0; i < config.cc.length; i++) {
        await this.#connection.writeCmd(
          "RCPT",
          "TO:",
          `<${config.cc[i].mail}>`,
        );
        this.#connection.assertCode(
          await this.#connection.readCmd(),
          CommandCode.OK,
        );
      }

      for (let i = 0; i < config.bcc.length; i++) {
        await this.#connection.writeCmd(
          "RCPT",
          "TO:",
          `<${config.bcc[i].mail}>`,
        );
        this.#connection.assertCode(
          await this.#connection.readCmd(),
          CommandCode.OK,
        );
      }

      await this.#connection.writeCmd("DATA");
      this.#connection.assertCode(
        await this.#connection.readCmd(),
        CommandCode.BEGIN_DATA,
      );

      await this.#connection.writeCmd("Subject: ", config.subject);
      await this.#connection.writeCmd(
        "From: ",
        `${config.from.name} <${config.from.mail}>`,
      );
      if (config.to.length > 0) {
        await this.#connection.writeCmd(
          "To: ",
          config.to.map((m) => `${m.name} <${m.mail}>`).join(";"),
        );
      }
      if (config.cc.length > 0) {
        await this.#connection.writeCmd(
          "Cc: ",
          config.cc.map((m) => `${m.name} <${m.mail}>`).join(";"),
        );
      }

      await this.#connection.writeCmd("Date: ", config.date);

      const obj = Object.entries(config.headers);

      for (let i = 0; i < obj.length; i++) {
        const [name, value] = obj[i];
        await this.#connection.writeCmd(name + ": ", value);
      }

      if (config.inReplyTo) {
        await this.#connection.writeCmd("InReplyTo: ", config.inReplyTo);
      }

      if (config.references) {
        await this.#connection.writeCmd("Refrences: ", config.references);
      }

      if (config.replyTo) {
        await this.#connection.writeCmd(
          "ReplyTo: ",
          `${config.replyTo.name} <${config.replyTo.name}>`,
        );
      }

      if (config.priority) {
        await this.#connection.writeCmd("Priority:", config.priority);
      }

      await this.#connection.writeCmd("MIME-Version: 1.0");

      let boundaryAdditionAtt = 100;
      // calc msg boundary
      // TODO: replace this with a match or so.
      config.mimeContent.map((v) => v.content).join("\n").replace(
        new RegExp("--attachment([0-9]+)", "g"),
        (_, numb) => {
          boundaryAdditionAtt += parseInt(numb, 10);

          return "";
        },
      );

      const dec = new TextDecoder();

      config.attachments.map((v) => {
        if (v.encoding === "text") return v.content;

        const arr = new Uint8Array(v.content);

        return dec.decode(arr);
      }).join("\n").replace(
        new RegExp("--attachment([0-9]+)", "g"),
        (_, numb) => {
          boundaryAdditionAtt += parseInt(numb, 10);

          return "";
        },
      );

      const attachmentBoundary = `attachment${boundaryAdditionAtt}`;

      await this.#connection.writeCmd(
        `Content-Type: multipart/mixed; boundary=${attachmentBoundary}`,
        "\r\n",
      );
      await this.#connection.writeCmd(`--${attachmentBoundary}`);

      let boundaryAddition = 100;
      // calc msg boundary
      // TODO: replace this with a match or so.
      config.mimeContent.map((v) => v.content).join("\n").replace(
        new RegExp("--message([0-9]+)", "g"),
        (_, numb) => {
          boundaryAddition += parseInt(numb, 10);

          return "";
        },
      );

      const messageBoundary = `message${boundaryAddition}`;

      await this.#connection.writeCmd(
        `Content-Type: multipart/alternative; boundary=${messageBoundary}`,
        "\r\n",
      );

      for (let i = 0; i < config.mimeContent.length; i++) {
        await this.#connection.writeCmd(`--${messageBoundary}`);
        await this.#connection.writeCmd(
          "Content-Type: " + config.mimeContent[i].mimeType,
        );
        if (config.mimeContent[i].transferEncoding) {
          await this.#connection.writeCmd(
            `Content-Transfer-Encoding: ${
              config.mimeContent[i].transferEncoding
            }` + "\r\n",
          );
        } else {
          // Send new line
          await this.#connection.writeCmd("");
        }

        await this.#connection.writeCmd(config.mimeContent[i].content, "\r\n");
      }

      await this.#connection.writeCmd(`--${messageBoundary}--\r\n`);

      for (let i = 0; i < config.attachments.length; i++) {
        const attachment = config.attachments[i];

        await this.#connection.writeCmd(`--${attachmentBoundary}`);
        await this.#connection.writeCmd(
          "Content-Type:",
          attachment.contentType + ";",
          "name=" + attachment.filename,
        );

        await this.#connection.writeCmd(
          `Content-ID: <attachment_id_${i}>`,
        );

        await this.#connection.writeCmd(
          "Content-Disposition: attachment; filename=" + attachment.filename,
          "\r\n",
        );

        if (attachment.encoding === "binary") {
          await this.#connection.writeCmd("Content-Transfer-Encoding: binary");

          if (
            attachment.content instanceof ArrayBuffer ||
            attachment.content instanceof SharedArrayBuffer
          ) {
            await this.#connection.writeCmdBinary(
              new Uint8Array(attachment.content),
            );
          } else {
            await this.#connection.writeCmdBinary(attachment.content);
          }

          await this.#connection.writeCmd("\r\n");
        } else if (attachment.encoding === "text") {
          await this.#connection.writeCmd(
            "Content-Transfer-Encoding: quoted-printable",
          );

          await this.#connection.writeCmd(attachment.content, "\r\n");
        }
      }

      await this.#connection.writeCmd(`--${attachmentBoundary}--\r\n`);

      await this.#connection.writeCmd(".\r\n");

      this.#connection.assertCode(
        await this.#connection.readCmd(),
        CommandCode.OK,
      );
      await this.#cleanup();
      this.#que.next();
    } catch (ex) {
      await this.#cleanup();
      this.#que.next();
      throw ex;
    }
  }

  async #prepareConnection() {
    this.#connection.assertCode(
      await this.#connection.readCmd(),
      CommandCode.READY,
    );

    await this.#connection.writeCmd("EHLO", this.config.connection.hostname);

    const cmd = await this.#connection.readCmd();

    if (!cmd) throw new Error("Unexpected empty response");

    if (typeof cmd.args === "string") {
      this.#supportedFeatures.add(cmd.args);
    } else {
      cmd.args.forEach((cmd) => {
        this.#supportedFeatures.add(cmd);
      });
    }

    if (
      this.#supportedFeatures.has("STARTTLS") && !this.config.debug.noStartTLS
    ) {
      await this.#connection.writeCmd("STARTTLS");
      this.#connection.assertCode(
        await this.#connection.readCmd(),
        CommandCode.READY,
      );

      const conn = await Deno.startTls(this.#connection.conn!, {
        hostname: this.config.connection.hostname,
      });
      this.#connection.setupConnection(conn);
      this.#connection.secure = true;

      await this.#connection.writeCmd("EHLO", this.config.connection.hostname);

      await this.#connection.readCmd();
    }

    if (!this.config.debug.allowUnsecure && !this.#connection.secure) {
      this.#connection.close();
      this.#connection = null as unknown as SMTPConnection;
      throw new Error(
        "Connection is not secure! Don't send authentication over non secure connection!",
      );
    }

    if (this.config.connection.auth) {
      await this.#connection.writeCmd("AUTH", "LOGIN");
      this.#connection.assertCode(await this.#connection.readCmd(), 334);

      await this.#connection.writeCmd(
        btoa(this.config.connection.auth.username),
      );
      this.#connection.assertCode(await this.#connection.readCmd(), 334);

      await this.#connection.writeCmd(
        btoa(this.config.connection.auth.password),
      );
      this.#connection.assertCode(
        await this.#connection.readCmd(),
        CommandCode.AUTHO_SUCCESS,
      );
    }

    await this.#cleanup();
  }

  #supportedFeatures = new Set<string>();

  async #cleanup() {
    this.#connection.writeCmd("NOOP");

    while (true) {
      const cmd = await this.#connection.readCmd();
      if (cmd && cmd.code === 250) return;
    }
  }
}
