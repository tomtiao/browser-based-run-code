import { MessagePayload } from ".";
import { RunProgramMessage } from "./cpp-loader";

// I hate this
/* eslint-disable */
// @ts-ignore
import FileSystem from "emception/FileSystem.mjs";

// @ts-ignore
import LlvmBoxProcess from "emception/LlvmBoxProcess.mjs";
// @ts-ignore
import BinaryenBoxProcess from "emception/BinaryenBoxProcess.mjs";
// @ts-ignore
import Python3Process from "emception/Python3Process.mjs";
// @ts-ignore
import NodeProcess from "emception/QuickNodeProcess.mjs";

// @ts-ignore
import root_pack from "emception/root_pack.mjs";
// @ts-ignore
import lazy_cache from "emception/lazy-cache/index.mjs";

class Emception {
    fileSystem: FileSystem = null;
    tools = {};

    async init() {
        const fileSystem = await new FileSystem();
        this.fileSystem = fileSystem;

        await fileSystem.cachedLazyFile(...root_pack);
        await fileSystem.unpack(root_pack[0]);

        // Populate the emscripten cache
        for (const [relpath, ...rest] of lazy_cache) {
            const path = `/emscripten/${relpath.slice(2)}`;
            await fileSystem.cachedLazyFile(path, ...rest);
        }

        if (fileSystem.exists("/emscripten/cache/cache.lock")) {
            fileSystem.unlink("/emscripten/cache/cache.lock");
        }

        const processConfig = {
            FS: fileSystem.FS,
            // @ts-ignore
            onrunprocess: (...args) => this._run_process(...args),
        };

        const tools = {
            "llvm-box": new LlvmBoxProcess(processConfig),
            "binaryen-box": new BinaryenBoxProcess(processConfig),
            "node": new NodeProcess(processConfig),
            "python": new Python3Process(processConfig),
            "main-python": new Python3Process(processConfig),
        };
        this.tools = tools;

        for (let tool in tools) {
            // @ts-ignore
            await tools[tool];
        }
    }

    onprocessstart = () => { };
    onprocessend = () => { };
    onstdout = () => { };
    onstderr = () => { };

    // @ts-ignore
    run(...args) {
        if (this.fileSystem!.exists("/emscripten/cache/cache.lock")) {
            this.fileSystem!.unlink("/emscripten/cache/cache.lock");
        }

        if (args.length == 1) args = args[0].split(/ +/);
        args = [
            "/usr/bin/python",
            "-E",
            `/emscripten/${args[0]}.py`,
            ...args.slice(1)
        ];
        // @ts-ignore
        return this.tools["main-python"].exec(args, {
            // @ts-ignore
            print: (...args) => this.onstdout(...args),
            // @ts-ignore
            printErr: (...args) => this.onstderr(...args),
            cwd: "/working",
            path: ["/emscripten"],
        })
    };

    // @ts-ignore
    _run_process(argv, opts = {}) {
        // @ts-ignore
        this.onprocessstart(argv);
        const result = this._run_process_impl(argv, opts);
        // @ts-ignore
        this.onprocessend(result);
        return result;
    }

    // @ts-ignore
    _run_process_impl(argv, opts = {}) {
        const in_emscripten = argv[0].match(/\/emscripten\/(.+)(\.py)?/)
        if (in_emscripten) {
            argv = [
                "/usr/bin/python",
                "-E",
                `/emscripten/${in_emscripten[1]}.py`,
                // @ts-ignore
                ...args.slice(1)
            ];
        }

        // @ts-ignore
        if (!this.fileSystem.exists(argv[0])) {
            const result = {
                returncode: 1,
                stdout: "",
                stderr: `Executable not found: ${JSON.stringify(argv[0])}`,
            };
            return result;
        }

        // @ts-ignore
        const tool_info = argv[0] === "/usr/bin/python" ? "python" : this.fileSystem.readFile(argv[0], { encoding: "utf8" });
        const [tool_name, ...extra_args] = tool_info.split(";")

        if (!(tool_name in this.tools)) {
            const result = {
                returncode: 1,
                stdout: "",
                stderr: `File is not executable: ${JSON.stringify(argv[0])}`,
            };
            return result;
        }

        argv = [...extra_args, ...argv];

        // @ts-ignore
        const tool = this.tools[tool_name];
        const result = tool.exec(argv, {
            ...opts,
            // @ts-ignore
            cwd: opts.cwd || "/",
            path: ["/emscripten"]
        });
        // @ts-ignore
        this.fileSystem.push();
        return result;
    };
}

const emception = new Emception();
// @ts-ignore
globalThis.emception = emception;
/* eslint-enable */

const programExecutor = new Worker(
    new URL("./cpp-program-executor.ts", import.meta.url),
    { type: "module" }
);

globalThis.addEventListener("message", function initCanvas(ev: MessageEvent<MessagePayload<{ type: "set_canvas", data: OffscreenCanvas; }>>) {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.type && ev.data.value.type === "set_canvas") {
        globalThis.removeEventListener("message", initCanvas);

        const message: MessagePayload<{ type: "set_canvas", data: OffscreenCanvas; }> = {
            id: "",
            type: "system",
            value: {
                type: "set_canvas",
                data: ev.data.value.data
            },
            err: null
        };
        programExecutor.postMessage(message, [ev.data.value.data]);
    }
});

programExecutor.addEventListener("message", handleExecutorPrint);
programExecutor.addEventListener("message", handleExecutorExit);

const createHandler = (language: "c" | "cpp", moduleName: string) => {
    return async (ev: MessageEvent<MessagePayload<{ language: string; code: string; compileOption?: string; }>>) => {
        if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.code && ev.data.value.language === language) {
            try {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                await emception.fileSystem.writeFile(`/working/main.${language}`, ev.data.value.code);
            } catch (error) {
                const message: MessagePayload<null> = {
                    id: ev.data.id,
                    err: error as Error,
                    value: null,
                    type: "system"
                };
                globalThis.postMessage(message);
    
                return;
            }
    
            const compilerEntry = language === "c" ? "emcc" : "em++";
            const customOption = ev.data.value.compileOption ?? "";
            const cmd = `${compilerEntry} ${customOption} main.${language} -sMODULARIZE -sEXPORT_NAME=${moduleName} -sHEADLESS -o main.js`;
            console.log(cmd);
    
            {
                const message: MessagePayload<{ stage: "compilation"; }> = {
                    id: ev.data.id,
                    err: null,
                    value: {
                        stage: "compilation"
                    },
                    type: "system"
                };
                globalThis.postMessage(message);
            }
    
            {
                const result = await emception.run(cmd);
                if (result.returncode !== 0) {
                    const message: MessagePayload<null> = {
                        id: ev.data.id,
                        err: new Error(result.stderr),
                        value: null,
                        type: "system"
                    };
                    globalThis.postMessage(message);
    
                    return;
                }
            }

            try {
                {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const javascriptFile: Uint8Array = await emception.fileSystem.readFile("/working/main.js");
    
                    const loadJsMessage: MessagePayload<RunProgramMessage<Uint8Array>> = {
                        id: ev.data.id,
                        err: null,
                        value: {
                            type: "load",
                            action: {
                                file_type: "js",
                                data: javascriptFile
                            }
                        },
                        type: "system"
                    };
                    programExecutor.postMessage(loadJsMessage, [javascriptFile.buffer]);
                    await new Promise<void>((resolve) => {
                        programExecutor.addEventListener("message", function f(ev: MessageEvent<MessagePayload<{ type: "loaded" }>>) {
                            if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.type && ev.data.value.type === "loaded") {
                                programExecutor.removeEventListener("message", f);
                                resolve();
                            }
                        });
                    });
                }

                {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const wasmBuffer: Uint8Array = await emception.fileSystem.readFile("/working/main.wasm");

                    const loadWasmMessage: MessagePayload<RunProgramMessage<Uint8Array>> = {
                        id: ev.data.id,
                        err: null,
                        value: {
                            type: "load",
                            action: {
                                file_type: "wasm",
                                data: wasmBuffer
                            }
                        },
                        type: "system"
                    };
                    programExecutor.postMessage(loadWasmMessage, [wasmBuffer.buffer]);

                    await new Promise<void>((resolve) => {
                        programExecutor.addEventListener("message", function f(ev: MessageEvent<MessagePayload<{ type: "loaded" }>>) {
                            if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.type && ev.data.value.type === "loaded") {
                                programExecutor.removeEventListener("message", f);
                                resolve();
                            }
                        });
                    });
                }

                {
                    const message: MessagePayload<{ stage: "running" }> = {
                        id: ev.data.id,
                        err: null,
                        value: {
                            stage: "running"
                        },
                        type: "system"
                    };
                    globalThis.postMessage(message);
                }

                {
                    const executeMessage: MessagePayload<RunProgramMessage> = {
                        id: ev.data.id,
                        err: null,
                        value: {
                            type: "execute",
                            action: {
                                moduleName
                            }
                        },
                        type: "system"
                    };
                    // send execute here
                    programExecutor.postMessage(executeMessage);
                }
            } catch (error) {
                const message: MessagePayload<null> = {
                    id: ev.data.id,
                    err: error as Error,
                    value: null,
                    type: "system"
                };
                globalThis.postMessage(message);
            }
        }
    };
}

const handleCppRequest = createHandler("cpp", "createCppProgram");
const handleCRequest = createHandler("c", "createCProgram");

// we just do delegation
function handleExecutorPrint(ev: MessageEvent<MessagePayload<string>>) {
    if (ev.data && ev.data.type === "application") {
        globalThis.postMessage(ev.data);
    }
}

// we just do delegation
function handleExecutorExit(ev: MessageEvent<MessagePayload<{ stage: "exit" }>>) {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.stage === "exit") {
        globalThis.postMessage(ev.data);
    }
}

emception.init()
    .then(() => {
        globalThis.postMessage({ value: { ready: true, language: "cpp" }, id: "", type: "system" });

        // handle C++ AND C here
        globalThis.addEventListener("message", handleCppRequest);
        globalThis.addEventListener("message", handleCRequest);
    });
