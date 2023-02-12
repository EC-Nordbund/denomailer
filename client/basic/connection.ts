import { ResolvedClientOptions } from "../../config/client.ts";

import { QUE } from "./QUE.ts";
import {
  TextDecoderStream,
  TextEncoderOrIntArrayStream,
  TextLineStream,
} from "./transforms.ts";

interface Command {
  code: number;
  args: string | (string[]);
}

export class SMTPConnection {
  #outTransform = new TextEncoderOrIntArrayStream();
  #decoder = new TextDecoderStream();
  #lineStream = new TextLineStream();

  #writableTransformStream = new TransformStream<
    string | Uint8Array,
    string | Uint8Array
  >();
  #readableStream: ReadableStream<string>;
  #reader: ReadableStreamDefaultReader<string>;
  #writer: WritableStreamDefaultWriter<string | Uint8Array>;

  #que = new QUE();

  constructor(public conn: Deno.Conn, private config: ResolvedClientOptions) {
    this.#writableTransformStream.readable.pipeThrough(this.#outTransform)
      .pipeTo(this.conn.writable);
    this.#readableStream = this.conn.readable.pipeThrough(this.#decoder)
      .pipeThrough(this.#lineStream);
    this.#reader = this.#readableStream.getReader();
    this.#writer = this.#writableTransformStream.writable.getWriter();
  }

  async cleanupForStartTLS() {
    await this.#reader.cancel();
    await this.#writer.close();
  }

  async readLine() {
    const ret = await this.#reader.read();
    return ret.value ?? null;
  }

  async write(chunks: (string | Uint8Array)[]) {
    if (chunks.length === 0) return;

    await this.#que.que();

    for (const chunk of chunks) {
      await this.#writer.write(chunk);
    }

    this.#que.next();
  }

  close() {
    try {
      this.conn.close();
    } catch (_ex) {
      // That is no error
    }
    try {
      this.#decoder.close();
    } catch (_ex) {
      // That is no error
    }
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
      result.push(await this.readLine());
    }

    const nonNullResult = result.filter((v): v is string => v !== null);

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

    return this.write([args.join(" ") + "\r\n"]);
  }

  public writeCmdBinary(...args: Uint8Array[]) {
    if (this.config.debug.log) {
      console.table(args.map(() => "Uint8Array"));
    }

    return this.write(args);
  }

  public async writeCmdAndRead(...args: string[]) {
    await this.writeCmd(...args);
    return this.readCmd();
  }

  public async writeCmdAndAssert(code: number, ...args: string[]) {
    const res = await this.writeCmdAndRead(...args);
    this.assertCode(res, code);
    return res;
  }
}
