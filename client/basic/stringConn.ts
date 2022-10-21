import { TextLineStream } from "../../deps.ts";
import { QUE } from "./QUE.ts";

class TextEncoderOrIntArrayStream {
  #encoder = new TextEncoder()

  #transform = new TransformStream<string | Uint8Array, Uint8Array>({
    transform: (chunk, ctx) => {
      if(typeof chunk === 'string') {
        ctx.enqueue(this.#encoder.encode(chunk))
        return
      }
      ctx.enqueue(chunk)
    }
  })

  get readable() {
    return this.#transform.readable;
  }

  get writable() {
    return this.#transform.writable;
  }
}


export class WrapedConn {
  #outTransform = new TextEncoderOrIntArrayStream()
  #decoder = new TextDecoderStream();
  #lineStream = new TextLineStream();
  
  #writableTransformStream = new TransformStream<string | Uint8Array, string | Uint8Array>()
  #readableStream: ReadableStream<string>
  #reader: ReadableStreamDefaultReader<string>
  #writer: WritableStreamDefaultWriter<string | Uint8Array>

  #que = new QUE()

  constructor(public conn: Deno.Conn) {
    this.#writableTransformStream.readable.pipeThrough(this.#outTransform).pipeTo(this.conn.writable)
    this.#readableStream = this.conn.readable.pipeThrough(this.#decoder).pipeThrough(this.#lineStream)
    this.#reader = this.#readableStream.getReader()
    this.#writer = this.#writableTransformStream.writable.getWriter()
  }

  async readLine() {
    const ret = await this.#reader.read()
    return ret.value ?? null
  }

  async write(chunks: (string| Uint8Array)[]) {
    if(chunks.length === 0) return

    await this.#que.que()

    for (const chunk of chunks) {
      await this.#writer.write(chunk)
    }
    
    this.#que.next()
  }

  close() {
    this.#reader.releaseLock()
    // await this.#reader.cancel()
    this.conn.close()
  }
}