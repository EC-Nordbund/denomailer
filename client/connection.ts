import { BufReader, BufWriter, TextProtoReader } from "../deps.ts";
import { ResolvedClientOptions } from '../config/client/mod.ts'

const encoder = new TextEncoder();

interface Command {
  code: number;
  args: string;
}

export class SMTPConnection {
  secure = false

  conn: Deno.Conn | null = null;
  #reader: TextProtoReader | null = null;
  #writer: BufWriter | null = null;

  constructor(private config: ResolvedClientOptions) {
    this.ready = this.#connect()
  }

  ready: Promise<void>

  async close() {
    if (!this.conn) {
      return;
    }
    await this.conn.close();
  }

  setupConnection(conn: Deno.Conn) {
    this.conn = conn

    const reader = new BufReader(this.conn);
    this.#writer = new BufWriter(this.conn);
    this.#reader = new TextProtoReader(reader);
  }

  async #connect() {
    if(this.config.connection.tls) {
      this.conn = await Deno.connectTls({
        hostname: this.config.connection.hostname,
        port: this.config.connection.port
      });
      this.secure = true;
    } else {
      this.conn = await Deno.connect({
        hostname: this.config.connection.hostname,
        port: this.config.connection.port
      });
    }
    
    await this.setupConnection(this.conn)
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
