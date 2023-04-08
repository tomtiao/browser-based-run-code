class WorkerManager {
  workers: Map<SupportedLanguage, Worker>;

  constructor() {
    this.workers = new Map();
  }

  async getWorker(type: SupportedLanguage) {
    if (this.workers.has(type)) {
      return this.workers.get(type)!;
    }

    const workerLoader: Loader = await import(`./${type}-loader.ts`);

    this.workers.set(type, workerLoader.worker);
    const data = await new Promise((resolve) => {
      workerLoader.worker.addEventListener("message", (ev: MessageEvent<MessagePayload<any>>) => {
        if (ev.data && ev.data.value && ev.data.value.ready) {
          resolve(ev.data);
        }
      }, { once: true });
    });
    console.log((data as any).value.language, "loaded");

    return workerLoader.worker;
  }

  static #instance: WorkerManager;
  static instance() {
    return (this.#instance ?? (this.#instance = new WorkerManager()));
  }
}

type Loader = {
  worker: Worker
}

export type SupportedLanguage =
  | "python"
  | "cpp";

export const supportedLanguageList: Readonly<SupportedLanguage[]> = [
  "python",
  "cpp"
] as const;

export { WorkerManager };

type MessagePayloadType =
  | "system"
  | "application"

export type MessagePayload<T = unknown> = {
  id: string;
  value: T;
  err: null;
  type: MessagePayloadType
}
  | {
    id: string;
    value: null;
    err: Error;
    type: MessagePayloadType;
  }