import { type MessagePayload } from ".";
import { RunProgramMessage } from "./cpp-loader";

let wasmBuffer: Uint8Array;
let javascriptUrl: string;

globalThis.addEventListener("message", (ev: MessageEvent<MessagePayload<RunProgramMessage<Uint8Array>>>) => {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.type) {
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
        } else {
            // execute the output file so we can get globalThis[moduleName](Module)
            importScripts(javascriptUrl);

            const offscreenCanvas = new OffscreenCanvas(400, 300);
            const Module = {
                instantiateWasm: function (imports: WebAssembly.Imports, successCallback: (instance: WebAssembly.Instance) => void) {
                    WebAssembly.instantiate(wasmBuffer, imports).then(function (output) {

                        /* eslint-disable */
                        // @ts-ignore
                        if (typeof WasmOffsetConverter != "undefined") {
                            // @ts-ignore
                            wasmOffsetConverter = new WasmOffsetConverter(wasmBinary, output.module);
                        }
                        console.log('wasm instantiation succeeded');
                        // @ts-ignore
                        Module.testWasmInstantiationSucceeded = 1;
                        successCallback(output.instance);
                        /* eslint-enable */
                    }).catch(function (e) {
                        console.log('wasm instantiation failed! ' + e);
                    });
                    return {};
                },
                print(msg?: string) {
                    const message: MessagePayload<string> = {
                        id: ev.data.id,
                        err: null,
                        value: msg + "\n",
                        type: "application"
                    };
                    globalThis.postMessage(message);
                },
                printErr(msg?: string) {
                    const message: MessagePayload<string> = {
                        id: ev.data.id,
                        err: null,
                        value: msg + "\n",
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
                canvas: (() => {
                    offscreenCanvas.addEventListener("webglcontextlost", () => {
                        console.error("webgl context lost. not much we can do");
                    });
                    return offscreenCanvas;
                })()
            };

            const { moduleName } = ev.data.value.action;
            /* eslint-disable */
            // @ts-ignore
            globalThis[moduleName](Module);
            /* eslint-enable */

            javascriptUrl = "";
            // wasmBuffer = new Uint8Array();
        }
    }
});
