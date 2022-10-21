export class QUE {
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
      if (this.#idbleCB) {
        this.#idbleCB();
      }
      return;
    }

    this.#que[0]();
    this.#que.splice(0, 1);
  }
}
