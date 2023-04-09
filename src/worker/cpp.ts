// @ts-nocheck
import FileSystem from "emception/FileSystem.mjs";

import LlvmBoxProcess from "emception/LlvmBoxProcess.mjs";
import BinaryenBoxProcess from "emception/BinaryenBoxProcess.mjs";
import Python3Process from "emception/Python3Process.mjs";
import NodeProcess from "emception/QuickNodeProcess.mjs";

import root_pack from "emception/root_pack.mjs";
import lazy_cache from "emception/lazy-cache/index.mjs";
import { MessagePayload } from ".";

class Emception {
    fileSystem = null;
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
            await tools[tool];
        }
    }

    onprocessstart = () => { };
    onprocessend = () => { };
    onstdout = () => { };
    onstderr = () => { };

    run(...args) {
        if (args.length == 1) args = args[0].split(/ +/);
        args = [
            "/usr/bin/python",
            "-E",
            `/emscripten/${args[0]}.py`,
            ...args.slice(1)
        ];
        return this.tools["main-python"].exec(args, {
            print: (...args) => this.onstdout(...args),
            printErr: (...args) => this.onstderr(...args),
            cwd: "/working",
            path: ["/emscripten"],
        })
    };

    _run_process(argv, opts = {}) {
        this.onprocessstart(argv);
        const result = this._run_process_impl(argv, opts);
        this.onprocessend(result);
        return result;
    }

    _run_process_impl(argv, opts = {}) {
        const in_emscripten = argv[0].match(/\/emscripten\/(.+)(\.py)?/)
        if (in_emscripten) {
            argv = [
                "/usr/bin/python",
                "-E",
                `/emscripten/${in_emscripten[1]}.py`,
                ...args.slice(1)
            ];
        }

        if (!this.fileSystem.exists(argv[0])) {
            const result = {
                returncode: 1,
                stdout: "",
                stderr: `Executable not found: ${JSON.stringify(argv[0])}`,
            };
            return result;
        }

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

        const tool = this.tools[tool_name];
        const result = tool.exec(argv, {
            ...opts,
            cwd: opts.cwd || "/",
            path: ["/emscripten"]
        });
        this.fileSystem.push();
        return result;
    };
}

const emception = new Emception();
globalThis.emception = emception;

emception.init()
    .then(() => {
        globalThis.postMessage({ value: { ready: true, language: "cpp" }, id: "", type: "system" });

        globalThis.addEventListener("message", async (ev: MessageEvent<MessagePayload<any>>) => {
            if (ev.data && ev.data.value.code && ev.data.value.language === "cpp") {
                try {
                    await emception.fileSystem.writeFile("/working/main.cpp", ev.data.value.code);
                } catch (error) {
                    const message: MessagePayload<any> = {
                        id: ev.data.id,
                        err: error as Error,
                        value: null,
                        type: "system"
                    };
                    globalThis.postMessage(message);

                    return;
                }

                const moduleName = "createCppProgram";
                const cmd = `em++ -O2 main.cpp -sSTANDALONE_WASM -sWASM_BIGINT -sMODULARIZE -sEXPORT_NAME=${moduleName} -o main.js`;
                console.log(cmd);

                const message: MessagePayload<any> = {
                    id: ev.data.id,
                    err: null,
                    value: {
                        stage: "compilation"
                    },
                    type: "system"
                };
                globalThis.postMessage(message);

                const result = await emception.run(cmd);
                if (result.returncode === 0) {
                    try {
                        const javascriptFileBuffer = await emception.fileSystem.readFile("/working/main.js", { encoding: "utf8" });

                        // execute the output file so we can get globalThis[moduleName](Module)
                        const javascriptUrl = URL.createObjectURL(new Blob([javascriptFileBuffer], { type: "application/javascript" }));
                        importScripts(javascriptUrl);

                        const wasmBuffer = emception.fileSystem.readFile("/working/main.wasm");
                        const Module = {
                            instantiateWasm: function (imports, successCallback) {
                                WebAssembly.instantiate(wasmBuffer, imports).then(function (output) {
                                    if (typeof WasmOffsetConverter != "undefined") {
                                        wasmOffsetConverter = new WasmOffsetConverter(wasmBinary, output.module);
                                    }
                                    console.log('wasm instantiation succeeded');
                                    Module.testWasmInstantiationSucceeded = 1;
                                    successCallback(output.instance);
                                }).catch(function (e) {
                                    console.log('wasm instantiation failed! ' + e);
                                });
                                return {};
                            },
                            print(msg: string) {
                                const message: MessagePayload<any> = {
                                    id: ev.data.id,
                                    err: null,
                                    value: msg,
                                    type: "application"
                                };
                                globalThis.postMessage(message);
                            },
                            postRun() {
                                URL.revokeObjectURL(javascriptUrl);
                                const message: MessagePayload<any> = {
                                    id: ev.data.id,
                                    err: null,
                                    value: {
                                        stage: "exit"
                                    },
                                    type: "system"
                                };
                                globalThis.postMessage(message);
                            }
                        };

                        const message: MessagePayload<any> = {
                            id: ev.data.id,
                            err: null,
                            value: {
                                stage: "running"
                            },
                            type: "system"
                        };
                        globalThis.postMessage(message);
                        globalThis[moduleName](Module);

                    } catch (error) {
                        const message: MessagePayload<any> = {
                            id: ev.data.id,
                            err: error,
                            value: null,
                            type: "system"
                        };
                        globalThis.postMessage(message);
                    }
                } else {
                    console.error(result);
                    const message: MessagePayload<any> = {
                        id: ev.data.id,
                        err: new Error("compilation failed"),
                        value: null,
                        type: "system"
                    };
                    globalThis.postMessage(message);
                }
            }
        });
    });