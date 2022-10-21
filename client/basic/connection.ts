import { ResolvedClientOptions } from "../../config/client.ts";
import { WrapedConn } from "./stringConn.ts";

interface Command {
  code: number;
  args: string | (string[]);
}

export class SMTPConnection {
  secure = false;

  #wrapedConnection!: WrapedConn

  conn: Deno.Conn | null = null;

  constructor(private config: ResolvedClientOptions) {
    this.ready = this.#connect();
  }

  ready: Promise<void>;

  async close() {
    await this.ready;
    await this.#wrapedConnection.close()
  }

  // Needed for starttls to inject a new connection
  setupConnection(conn: Deno.Conn) {
    this.#wrapedConnection = new WrapedConn(conn)
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
    const result: (string | null)[] = [];

    while (
      result.length === 0 || (result.at(-1) && result.at(-1)!.at(3) === "-")
    ) {
      result.push(await this.#wrapedConnection.readLine());
    }

    const nonNullResult = result.filter((v): v is string=>v!==null)

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

  public writeCmd(...args: string[]) {
    if (this.config.debug.log) {
      console.table(args);
    }

    return this.#wrapedConnection.write([args.join(" ") + '\r\n'])
  }

  public writeCmdBinary(...args: Uint8Array[]) {
    if (this.config.debug.log) {
      console.table(args.map(() => "Uint8Array"));
    }

    return this.#wrapedConnection.write(args)
  }
}
