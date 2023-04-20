import type { ResolvedSendConfig } from "../../config/mail/mod.ts";
import type { ResolvedContent } from "../../config/mail/content.ts";
import type { ResolvedAttachment } from "../../config/mail/attachments.ts";
import { ResolvedClientOptions } from "../../config/client.ts";
import { SMTPConnection } from "./connection.ts";
import { QUE } from "./QUE.ts";

const CommandCode = {
  READY: 220,
  AUTHO_NEXT: 334,
  AUTHO_SUCCESS: 235,
  OK: 250,
  BEGIN_DATA: 354,
  FAIL: 554,
};

export class SMTPClient {
  secure = false;

  #connection!: SMTPConnection;
  #que = new QUE();

  constructor(private config: ResolvedClientOptions) {
    this.#ready = (async () => {
      let conn: Deno.Conn;
      if (this.config.connection.tls) {
        conn = await Deno.connectTls({
          hostname: this.config.connection.hostname,
          port: this.config.connection.port,
        });
        this.secure = true;
      } else {
        conn = await Deno.connect({
          hostname: this.config.connection.hostname,
          port: this.config.connection.port,
        });
      }
      this.#connection = new SMTPConnection(conn, config);

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

  calcBoundary(content: string, pattern: RegExp): number {
    let boundary = 100;

    const matches = content.matchAll(pattern);
    for (const match of matches) {
      boundary += parseInt(match[1], 10);
    }

    return boundary;
  }

  encodeContent(content: ResolvedContent) {
    this.#connection.writeCmd(
      "Content-Type: " + content.mimeType,
    );
    if (content.transferEncoding) {
      this.#connection.writeCmd(
        `Content-Transfer-Encoding: ${content.transferEncoding}\r\n`,
      );
    } else {
      this.#connection.writeCmd("");
    }

    this.#connection.writeCmd(content.content + "\r\n");
  }

  encodeAttachment(attachment: ResolvedAttachment) {
    this.#connection.writeCmd(
      `Content-Type: ${attachment.contentType}; name=${attachment.filename}`,
    );

    if (attachment.contentID) {
      this.#connection.writeCmd(
        `Content-ID: <${attachment.contentID}>`,
      );
    }

    this.#connection.writeCmd(
      `Content-Disposition: ${attachment.contentDisposition}; filename=${attachment.filename}`,
    );

    if (attachment.encoding === "base64") {
      this.#connection.writeCmd(
        "Content-Transfer-Encoding: base64\r\n",
      );

      for (
        let line = 0;
        line < Math.ceil(attachment.content.length / 75);
        line++
      ) {
        const lineOfBase64 = attachment.content.slice(
          line * 75,
          (line + 1) * 75,
        );

        this.#connection.writeCmd(lineOfBase64);
      }

      this.#connection.writeCmd("\r\n");
    } else if (attachment.encoding === "text") {
      this.#connection.writeCmd(
        "Content-Transfer-Encoding: quoted-printable\r\n",
      );

      this.#connection.writeCmd(attachment.content + "\r\n");
    }
  }

  encodeRelated(content: ResolvedContent) {
    const boundaryAddRel = this.calcBoundary(
      content.content + "\n" +
        content.relatedAttachments.map((v) => v.content).join("\n"),
      new RegExp("--related([0-9]+)", "g"),
    );

    const relatedBoundary = `related${boundaryAddRel}`;
    this.#connection.writeCmd(
      `Content-Type: multipart/related; boundary=${relatedBoundary}\r\n; type=${content.mimeType}`,
    );

    this.#connection.writeCmd(`--${relatedBoundary}`);
    this.encodeContent(content);

    for (let i = 0; i < content.relatedAttachments.length; i++) {
      this.#connection.writeCmd(`--${relatedBoundary}`);
      this.encodeAttachment(content.relatedAttachments[i]);
    }

    this.#connection.writeCmd(`--${relatedBoundary}--\r\n`);
  }

  async send(config: ResolvedSendConfig) {
    await this.#ready;
    let dataMode = false;
    try {
      await this.#que.que();

      await this.#connection.writeCmdAndAssert(
        CommandCode.OK,
        "MAIL",
        "FROM:",
        `<${config.from.mail}>`,
      );

      for (let i = 0; i < config.to.length; i++) {
        await this.#connection.writeCmdAndAssert(
          CommandCode.OK,
          "RCPT",
          "TO:",
          `<${config.to[i].mail}>`,
        );
      }

      for (let i = 0; i < config.cc.length; i++) {
        await this.#connection.writeCmdAndAssert(
          CommandCode.OK,
          "RCPT",
          "TO:",
          `<${config.cc[i].mail}>`,
        );
      }

      for (let i = 0; i < config.bcc.length; i++) {
        await this.#connection.writeCmdAndAssert(
          CommandCode.OK,
          "RCPT",
          "TO:",
          `<${config.bcc[i].mail}>`,
        );
      }

      dataMode = true;
      await this.#connection.writeCmdAndAssert(CommandCode.BEGIN_DATA, "DATA");

      this.#connection.writeCmd("Subject: ", config.subject);
      this.#connection.writeCmd(
        "From: ",
        `${config.from.name} <${config.from.mail}>`,
      );
      if (config.to.length > 0) {
        this.#connection.writeCmd(
          "To: ",
          config.to.map((m) => `${m.name} <${m.mail}>`).join(";"),
        );
      }
      if (config.cc.length > 0) {
        this.#connection.writeCmd(
          "Cc: ",
          config.cc.map((m) => `${m.name} <${m.mail}>`).join(";"),
        );
      }

      this.#connection.writeCmd("Date: ", config.date);

      const obj = Object.entries(config.headers);

      for (let i = 0; i < obj.length; i++) {
        const [name, value] = obj[i];
        this.#connection.writeCmd(name + ": ", value);
      }

      if (config.inReplyTo) {
        this.#connection.writeCmd("InReplyTo: ", config.inReplyTo);
      }

      if (config.references) {
        this.#connection.writeCmd("References: ", config.references);
      }

      if (config.replyTo) {
        this.#connection.writeCmd(
          "Reply-To: ",
          `${config.replyTo.name} <${config.replyTo.mail}>`,
        );
      }

      if (config.priority) {
        this.#connection.writeCmd("Priority:", config.priority);
      }

      this.#connection.writeCmd("MIME-Version: 1.0");

      const boundaryAdditionAtt = this.calcBoundary(
        config.mimeContent.map((v) => v.content).join("\n") + "\n" +
          config.attachments.map((v) => v.content).join("\n"),
        new RegExp("--attachment([0-9]+)", "g"),
      );

      const attachmentBoundary = `attachment${boundaryAdditionAtt}`;

      this.#connection.writeCmd(
        `Content-Type: multipart/mixed; boundary=${attachmentBoundary}`,
        "\r\n",
      );
      this.#connection.writeCmd(`--${attachmentBoundary}`);

      const boundaryAdditionMsg = this.calcBoundary(
        config.mimeContent.map((v) => v.content).join("\n"),
        new RegExp("--message([0-9]+)", "g"),
      );

      const messageBoundary = `message${boundaryAdditionMsg}`;

      this.#connection.writeCmd(
        `Content-Type: multipart/alternative; boundary=${messageBoundary}`,
        "\r\n",
      );

      for (let i = 0; i < config.mimeContent.length; i++) {
        this.#connection.writeCmd(`--${messageBoundary}`);
        if (config.mimeContent[i].relatedAttachments.length === 0) {
          this.encodeContent(config.mimeContent[i]);
        } else {
          this.encodeRelated(config.mimeContent[i]);
        }
      }

      this.#connection.writeCmd(`--${messageBoundary}--\r\n`);

      for (let i = 0; i < config.attachments.length; i++) {
        this.#connection.writeCmd(`--${attachmentBoundary}`);
        this.encodeAttachment(config.attachments[i]);
      }

      this.#connection.writeCmd(`--${attachmentBoundary}--\r\n`);

      // Wait for all writes to finish
      await this.#connection.writeCmdAndAssert(CommandCode.OK, ".\r\n");

      dataMode = false;
      await this.#cleanup();
      this.#que.next();
    } catch (ex) {
      if (dataMode) {
        console.error("Error while in datamode - connection not recoverable");
        queueMicrotask(() => {
          this.#connection.conn?.close();
        });
        throw ex;
      }
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
      // When in TLS don't use STARTTLS
      !this.secure &&
      // Check for STARTTLS support
      this.#supportedFeatures.has("STARTTLS") &&
      // Check that STARTTLS is allowed
      !this.config.debug.noStartTLS
    ) {
      this.#connection.writeCmdAndAssert(CommandCode.READY, "STARTTLS");

      await this.#connection.cleanupForStartTLS();

      const conn = await Deno.startTls(this.#connection.conn, {
        hostname: this.config.connection.hostname,
      });
      this.#connection = new SMTPConnection(conn, this.config);
      this.secure = true;

      this.#connection.writeCmdAndRead("EHLO", this.config.connection.hostname);
    }

    if (!this.config.debug.allowUnsecure && !this.secure) {
      this.#connection.close();
      this.#connection = null as unknown as SMTPConnection;
      throw new Error(
        "Connection is not secure! Don't send authentication over non secure connection!",
      );
    }

    if (this.config.connection.auth) {
      await this.#connection.writeCmdAndAssert(
        CommandCode.AUTHO_NEXT,
        "AUTH",
        "LOGIN",
      );
      await this.#connection.writeCmdAndAssert(
        CommandCode.AUTHO_NEXT,
        btoa(this.config.connection.auth.username),
      );
      await this.#connection.writeCmdAndAssert(
        CommandCode.AUTHO_SUCCESS,
        btoa(this.config.connection.auth.password),
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
