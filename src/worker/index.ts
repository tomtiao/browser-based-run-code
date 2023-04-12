import { globalWorkerErrorHandler } from "../utils";

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
    // TODO
    workerLoader.worker.addEventListener("error", globalWorkerErrorHandler);

    let workerReadyPromise;
    if (this.#workerReadyPromises.has(type)) {
      workerReadyPromise = this.#workerReadyPromises.get(type)!;
    } else {
      workerReadyPromise = new Promise<void>((resolve) => {

        workerLoader.worker.addEventListener("message", (ev: MessageEvent<MessagePayload<{ ready: boolean; }>>) => {
          if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.ready) {
            this.#passInputBuffer(workerLoader.worker);
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

  #passInputBuffer(worker: Worker) {
    const inputBuffer = new SharedArrayBuffer(WorkerManager.MAX_INPUT_BUFFER_SIZE);
    const typedArray = new Int32Array(inputBuffer);

    this.#workerInputBuffer.set(worker, typedArray);

    const message: MessagePayload<{ type: "stdin_init", data: SharedArrayBuffer }> = {
      id: "",
      err: null,
      value: {
        type: "stdin_init",
        data: inputBuffer
      },
      type: "system"
    };
    worker.postMessage(message);
  }

  async destroyWorker(type: SupportedLanguage) {
    if (this.#workers.has(type)) {
      const loader = await this.#loadingModulePromises.get(type)!;
      this.#workerInputBuffer.delete(loader.worker);
      this.#workers.delete(type);
      this.#workerReadyPromises.delete(type);

      loader.destroyWorker();
    }
  }

  static #instance: WorkerManager;
  static instance() {
    return (this.#instance ?? (this.#instance = new WorkerManager()));
  }

  static readonly MAX_INPUT_BUFFER_SIZE = 1024;
  #workerInputBuffer: WeakMap<Worker, Int32Array> = new WeakMap();
  
  responseWorkerInput(worker: Worker, inputStr: string) {
    const typedArray = this.#workerInputBuffer.get(worker)!;

    // a utf8 char is at max 4 bytes
    const inputStrSlice = inputStr.slice(0, ((WorkerManager.MAX_INPUT_BUFFER_SIZE - 1) / 3) | 0);
    
    // Int32Array的第一个位置存放输入长度`x`（小于`MAX_INPUT_BUFFER_SIZE-1`），
    // 后`x`项是字符串数据，剩余项未定义

    const rawUint8Data = new TextEncoder().encode(inputStrSlice);
    // 如果不能用四字节表示，在末尾填充`0`
    const padLength = ((Math.trunc(rawUint8Data.byteLength / 4)) + 1) * 4;
    const padUint8Data = new Uint8Array(padLength);
    padUint8Data.set(rawUint8Data);
    const int32View = new Int32Array(padUint8Data.buffer);

    typedArray[0] = inputStrSlice.length;
    typedArray.set(int32View, 1);

    // wake up the thread
    Atomics.notify(typedArray, 0);
  }
}

export const workerManager = WorkerManager.instance();
// preload worker
// workerManager.getWorker("cpp");
workerManager.getWorker("python");

type Loader = {
  worker: Worker,
  destroyWorker: () => void;
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

export const languageLabelMap = {
  python: "Python",
  cpp: "C++",
  c: "C"
} as const;

export const languageOutputTypeMap = {
  python: "image",
  cpp: "canvas",
  c: "canvas"
} as const;

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