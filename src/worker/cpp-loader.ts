export const worker = new Worker(new URL(`./cpp.ts`, import.meta.url), {
    type: "module",
});

export const destroyWorker = () => {
    worker.terminate();
};

export type RunProgramMessage<T = unknown> = {
    type: "load";
    action: {
        file_type: "js" | "wasm";
        data: T;
    }
} | {
    type: "execute";
    action: {
        moduleName: string;
    }
}