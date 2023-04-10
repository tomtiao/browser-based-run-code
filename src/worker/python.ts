import { type PyodideInterface, } from "pyodide";
import { MessagePayload } from ".";

class PyodideLoader {
  static pyodide: PyodideInterface;

  static async getPyodide() {
    if (!PyodideLoader.pyodide) {
      const { loadPyodide } = await import("pyodide/pyodide.js");
      PyodideLoader.pyodide = await loadPyodide({
        indexURL: "./lib/pyodide",
      });
      await PyodideLoader.pyodide.loadPackage("micropip");
      const micropip = PyodideLoader.pyodide.pyimport("micropip");
      await micropip.install("matplotlib");
    }
    return PyodideLoader.pyodide;
  }
}

let inputBufferArray: Int32Array;
PyodideLoader.getPyodide().then(async (pyodide) => {

  globalThis.postMessage({ value: { ready: true, language: "python" }, id: "", type: "system" });

  globalThis.addEventListener("message", function receiveInputBuffer(ev: MessageEvent<MessagePayload<{ type: "stdin_init", data: SharedArrayBuffer }>>) {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.type === "stdin_init") {
      globalThis.removeEventListener("message", receiveInputBuffer);

      inputBufferArray = new Int32Array(ev.data.value.data);
    }
  });

  globalThis.addEventListener("message", async (ev: MessageEvent<MessagePayload<{ language: "python"; code: string; }>>) => {
    if (ev.data && ev.data.type === "system" && ev.data.value && ev.data.value.language === "python" && ev.data.value.code) {
      try {
        const preMessage: MessagePayload<{ stage: "running"; }> = {
          id: ev.data.id,
          err: null,
          value: {
            stage: "running"
          },
          type: "system"
        };
        globalThis.postMessage(preMessage);

        {
          pyodide.setStdin({
            stdin() {
              const message: MessagePayload<{ type: "stdin_request"; }> = {
                id: ev.data.id,
                err: null,
                value: {
                  type: "stdin_request",
                },
                type: "system"
              };
              globalThis.postMessage(message);

              const lookupPos = 0;
              const expectedValue = 0;
              // block the thread here
              const result = Atomics.wait(inputBufferArray, lookupPos, expectedValue);
      
              switch (result) {
                case "not-equal": {
                  throw new Error(`inputBuffer[${lookupPos}] is not ${expectedValue} when waiting input response! id: ${ev.data.id}`);
                }
                case "timed-out": {
                  throw new Error(`wait result "timed-out" not implemented`);
                }
                case "ok":
                  break;
              }
              // read the input buffer
              const len = inputBufferArray[0];
              const inputStrData = inputBufferArray.slice(1, len + 1);
              const inputStr = new TextDecoder().decode(inputStrData);

              // mark input as clean
              inputBufferArray[0] = 0;

              return inputStr;
            },
          });
        }

        {          
          pyodide.setStdout({
            batched(s) {
              const postAppMessage = {
                id: ev.data.id,
                err: null,
                value: s + '\n',
                type: "application"
              };
              globalThis.postMessage(postAppMessage);
            }
          });

          pyodide.setStderr({
            batched(s) {
              const postAppMessage = {
                id: ev.data.id,
                err: new Error(s + '\n'),
                value: null,
                type: "application"
              };
              globalThis.postMessage(postAppMessage);
            }
          });
        }

        await pyodide.runPythonAsync(ev.data.value.code);
        const postSysMessage = {
          id: ev.data.id,
          err: null,
          value: {
            stage: "exit"
          },
          type: "system"
        };
        globalThis.postMessage(postSysMessage);

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
  });
});
