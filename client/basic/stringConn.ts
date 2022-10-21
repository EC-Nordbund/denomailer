import { TextLineStream } from "../../deps.ts";
import { QUE } from "./QUE.ts";

class TextEncoderOrIntArrayStream implements TransformStream {
  #encoder = new TextEncoder();

  #transform = new TransformStream<string | Uint8Array, Uint8Array>({
    transform: (chunk, ctx) => {
      if (typeof chunk === "string") {
        ctx.enqueue(this.#encoder.encode(chunk));
        return;
      }
      ctx.enqueue(chunk);
    },
  });

  get readable() {
    return this.#transform.readable;
  }

  get writable() {
    return this.#transform.writable;
  }
}

class TextDecoderStream implements TransformStream {
  #decoder: TextDecoder;
  #transform: TransformStream<BufferSource, string>;

  constructor(label = "utf-8", options: TextDecoderOptions = {}) {
    this.#decoder = new TextDecoder(label, options);
    this.#transform = new TransformStream({
      // The transform and flush functions need access to TextDecoderStream's
      // `this`, so they are defined as functions rather than methods.
      transform: (chunk, controller) => {
        try {
          const decoded = this.#decoder.decode(chunk, { stream: true });
          if (decoded) {
            controller.enqueue(decoded);
          }
          return Promise.resolve();
        } catch (err) {
          return Promise.reject(err);
        }
      },
      flush: (controller) => {
        try {
          const final = this.#decoder.decode();
          if (final) {
            controller.enqueue(final);
          }
          return Promise.resolve();
        } catch (err) {
          return Promise.reject(err);
        }
      },
    });
  }

  get encoding() {
    return this.#decoder.encoding;
  }

  get fatal() {
    return this.#decoder.fatal;
  }

  get ignoreBOM() {
    return this.#decoder.ignoreBOM;
  }

  get readable() {
    return this.#transform.readable;
  }

  get writable() {
    return this.#transform.writable;
  }

  close() {
    this.#decoder.decode();
  }
}

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
    // this.#reader.releaseLock()
    this.conn.close();
    this.#decoder.close();
    // await this.conn.readable.cancel()
    // await this.#reader.cancel()

    // await this.#decoder.writable.abort()
    // await this.#decoder.readable.cancel()
  }
}
