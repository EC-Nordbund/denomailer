import { BufWriter, TextLineStream } from "../../deps.ts";
import { ResolvedClientOptions } from "../../config/client.ts";

const encoder = new TextEncoder();

interface Command {
  code: number;
  args: string | (string[]);
}

export class SMTPConnection {
  secure = false;

  conn: Deno.Conn | null = null;
  #reader: ReadableStreamDefaultReader<string> | null = null;
  #writer: BufWriter | null = null;
  #decoder = new TextDecoderStream();
  #lineStream = new TextLineStream();

  constructor(private config: ResolvedClientOptions) {
    this.ready = this.#connect();
  }

  ready: Promise<void>;

  async close() {
    await this.ready;
    if (!this.conn) {
      return;
    }
    await this.conn.close();
    await this.#reader!.releaseLock()
    await this.conn.readable.cancel();
  }

  setupConnection(conn: Deno.Conn) {
    this.conn = conn;
    this.#writer = new BufWriter(this.conn);
    this.#reader = this.conn.readable
      .pipeThrough(this.#decoder)
      .pipeThrough(this.#lineStream)
      .getReader();
  }

  async #connect() {
    if (this.config.connection.tls) {
      this.conn = await Deno.connectTls({
        hostname: this.config.connection.hostname,
        port: this.config.connection.port,
      });
      this.secure = true;
    } else {
      this.conn = await Deno.connect({
        hostname: this.config.connection.hostname,
        port: this.config.connection.port,
      });
    }

    this.setupConnection(this.conn);
  }

  public assertCode(cmd: Command | null, code: number, msg?: string) {
    if (!cmd) {
      throw new Error(`invalid cmd`);
    }
    if (cmd.code !== code) {
      throw new Error(msg || cmd.code + ": " + cmd.args);
    }
  }

  public async readCmd(): Promise<Command | null> {
    if (!this.#reader) {
      return null;
    }

    const result: (string | null)[] = [];

    while (
      result.length === 0 || (result.at(-1) && result.at(-1)!.at(3) === "-")
    ) {
      result.push((await this.#reader.read()).value ?? null);
    }

    const nonNullResult: string[] =
      (result.at(-1) === null
        ? result.slice(0, result.length - 1) // deno-lint-ignore no-explicit-any
        : result) as any;

    if (nonNullResult.length === 0) return null;

    const code = parseInt(nonNullResult[0].slice(0, 3));
    const data = nonNullResult.map((v) => v.slice(4).trim());

    if (this.config.debug.log) {
      nonNullResult.forEach((v) => console.log(v));
    }

    return {
      code,
      args: data,
    };
  }

  public async writeCmd(...args: string[]) {
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

  public async writeCmdBinary(...args: Uint8Array[]) {
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
