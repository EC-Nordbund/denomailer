import { QUE } from "./QUE.ts";
import { TextEncoderOrIntArrayStream, TextDecoderStream, TextLineStream } from "./transforms.ts"

export class WrapedConn {
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

  constructor(public conn: Deno.Conn) {
    this.#writableTransformStream.readable.pipeThrough(this.#outTransform)
      .pipeTo(this.conn.writable);
    this.#readableStream = this.conn.readable.pipeThrough(this.#decoder)
      .pipeThrough(this.#lineStream);
    this.#reader = this.#readableStream.getReader();
    this.#writer = this.#writableTransformStream.writable.getWriter();
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
    this.conn.close();
    this.#decoder.close();
  }
}
