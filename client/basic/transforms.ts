export class TextEncoderOrIntArrayStream implements TransformStream {
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
export class TextLineStream {
  #buf = "";
  #transform = new TransformStream<string, string>({
    transform: (chunk, controller) => this.#handle(chunk, controller),
    flush: (controler) => this.#handle("\r\n", controler),
  });

  get readable() {
    return this.#transform.readable;
  }

  get writable() {
    return this.#transform.writable;
  }

  #handle(chunk: string, controller: TransformStreamDefaultController<string>) {
    chunk = this.#buf + chunk;

    const chunks = chunk.split("\r\n");
    if (chunks.length > 1) {
      for (let i = 0; i < chunks.length - 1; i++) {
        controller.enqueue(chunks[i]);
      }
    }
    this.#buf = chunks.at(-1) ?? "";
  }
}
export class TextDecoderStream implements TransformStream {
  #decoder: TextDecoder;
  #transform: TransformStream<BufferSource, string>;

  constructor(label = "utf-8", options: TextDecoderOptions = {}) {
    this.#decoder = new TextDecoder(label, options);
    this.#transform = new TransformStream({
      transform: (chunk, controller) => {
        const decoded = this.#decoder.decode(chunk, { stream: true });
        if (decoded) {
          controller.enqueue(decoded);
        }
      },
      flush: (controller) => {
        const final = this.#decoder.decode();
        if (final) {
          controller.enqueue(final);
        }
      },
    });
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
