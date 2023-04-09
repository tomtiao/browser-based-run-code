class WorkerManager {
  #workers: Map<SupportedLanguage, Worker> = new Map();

  #loadingModulePromises: Map<SupportedLanguage, Promise<Loader>> = new Map();
  #workerReadyPromises: Map<SupportedLanguage, Promise<void>> = new Map();

  async getWorker(type: SupportedLanguage) {
    if (this.#workers.has(type)) {
      return this.#workers.get(type)!;
    }
    
    if (this.#loadingModulePromises.has(type)) {
      return this.#loadWorker(type, await this.#loadingModulePromises.get(type)!);
    }

    const modulePromise = import(`./${type}-loader.ts`);
    this.#loadingModulePromises.set(type, modulePromise);
    const workerLoader: Loader = await modulePromise;

    return this.#loadWorker(type, workerLoader);
  }

  async #loadWorker(type: SupportedLanguage, workerLoader: Loader) {
    let workerReadyPromise;
    if (this.#workerReadyPromises.has(type)) {
      workerReadyPromise = this.#workerReadyPromises.get(type)!;
    } else {
      workerReadyPromise = new Promise<void>((resolve) => {
        workerLoader.worker.addEventListener("message", (ev: MessageEvent<MessagePayload<any>>) => {
          if (ev.data && ev.data.value && ev.data.value.ready) {
            resolve();
          }
        }, { once: true });
      });
      this.#workerReadyPromises.set(type, workerReadyPromise);
    }

    await workerReadyPromise;
    this.#workers.set(type, workerLoader.worker);

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
  | "cpp"
  | "c";

export const supportedLanguageMap = {
  python: "python",
  cpp: "cpp",
  c: "cpp" // C use cpp worker
} as const;

export const languageCompileOptionMap = {
  python: false,
  cpp: true,
  c: true
} as const;

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