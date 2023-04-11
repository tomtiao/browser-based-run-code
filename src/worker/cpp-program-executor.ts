import { type MessagePayload } from ".";
import { RunProgramMessage } from "./cpp-loader";

let wasmBuffer: Uint8Array;
let javascriptUrl: string;

const offscreenCanvasRef: { value: OffscreenCanvas | null; } = { value: null };
globalThis.addEventListener("message", function initCanvas(ev: MessageEvent<MessagePayload<{ type: "set_canvas", data: OffscreenCanvas; }>>) {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.type && ev.data.value.type === "set_canvas") {
        globalThis.removeEventListener("message", initCanvas);

        offscreenCanvasRef.value = ev.data.value.data;
    }
});

globalThis.addEventListener("message", (ev: MessageEvent<MessagePayload<RunProgramMessage<Uint8Array>>>) => {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.type) {
        if (ev.data.value.type === "load") {
            const { file_type, data } = ev.data.value.action;
            switch (file_type) {
                case "js": {
                    javascriptUrl = URL.createObjectURL(new Blob([data.buffer], { type: "application/javascript" }));
                } break;
                case "wasm": {
                    wasmBuffer = data;
                } break;
            }

            const message: MessagePayload<{ type: "loaded" }> = {
                id: ev.data.id,
                err: null,
                value: {
                    type: "loaded"
                },
                type: "system"
            };
            globalThis.postMessage(message);
        } else if (ev.data.value.type === "execute") {
            // execute the output file so we can get globalThis[moduleName](Module)
            importScripts(javascriptUrl);

            const Module = {
                instantiateWasm: function (imports: WebAssembly.Imports, successCallback: (instance: WebAssembly.Instance) => void) {
                    (async () => {
                        let output: WebAssembly.WebAssemblyInstantiatedSource;
                        try {
                            output = await WebAssembly.instantiate(wasmBuffer, imports);

                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            if (typeof WasmOffsetConverter != "undefined") {
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                wasmOffsetConverter = new WasmOffsetConverter(wasmBuffer, output.module);
                            }
                            console.log('wasm instantiation succeeded');
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            Module.testWasmInstantiationSucceeded = 1;
                            try {
                                successCallback(output.instance);
                            } catch (e) {
                                console.log('successCallback failed! ' + e);
                                {
                                    const message: MessagePayload<null> = {
                                        id: ev.data.id,
                                        err: e as Error,
                                        value: null,
                                        type: "application"
                                    };
                                    globalThis.postMessage(message);
                                }

                                // should we emit `exit` message here?
                                {
                                    const message: MessagePayload<{ stage: "exit"; }> = {
                                        id: ev.data.id,
                                        err: null,
                                        value: {
                                            stage: "exit"
                                        },
                                        type: "system"
                                    };
                                    globalThis.postMessage(message);
                                }
                            }
                        } catch (e) {
                            console.log('wasm instantiation failed! ' + e);

                            {
                                const message: MessagePayload<null> = {
                                    id: ev.data.id,
                                    err: e as Error,
                                    value: null,
                                    type: "application"
                                };
                                globalThis.postMessage(message);
                            }

                            // should we emit `exit` message here?
                            {
                                const message: MessagePayload<{ stage: "exit"; }> = {
                                    id: ev.data.id,
                                    err: null,
                                    value: {
                                        stage: "exit"
                                    },
                                    type: "system"
                                };
                                globalThis.postMessage(message);
                            }
                        }
                    })();

                    return {};
                },
                print(msg?: string) {
                    const message: MessagePayload<string> = {
                        id: ev.data.id,
                        err: null,
                        value: (msg ?? "") + "\n",
                        type: "application"
                    };
                    globalThis.postMessage(message);
                },
                printErr(msg?: string) {
                    const message: MessagePayload<null> = {
                        id: ev.data.id,
                        err: new Error((msg ?? "") + "\n"),
                        value: null,
                        type: "application"
                    };
                    globalThis.postMessage(message);
                },
                postRun() {
                    URL.revokeObjectURL(javascriptUrl);

                    const message: MessagePayload<{ stage: "exit"; }> = {
                        id: ev.data.id,
                        err: null,
                        value: {
                            stage: "exit"
                        },
                        type: "system"
                    };
                    globalThis.postMessage(message);
                },
                doNotCaptureKeyboard: true,
                canvas: (() => {
                    if (!offscreenCanvasRef.value) {
                        throw new Error("offscreenCanvas is null");
                    }
                    offscreenCanvasRef.value.addEventListener("webglcontextlost", () => {
                        console.error("webgl context lost. not much we can do");
                    });
                    return offscreenCanvasRef.value;
                })()
            };

            const { moduleName } = ev.data.value.action;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            globalThis[moduleName](Module);

            javascriptUrl = "";
            // wasmBuffer = new Uint8Array();
        }
    }
});
