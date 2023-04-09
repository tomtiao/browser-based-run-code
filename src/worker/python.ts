import { type PyodideInterface, } from "pyodide";
import { MessagePayload } from ".";

class PyodideLoader {
  static pyodide: PyodideInterface;

  static stdout = "";

  static async getPyodide() {
    if (!PyodideLoader.pyodide) {
      const { loadPyodide } = await import("pyodide/pyodide.js");
      PyodideLoader.pyodide = await loadPyodide({
        indexURL: "./lib/pyodide",
        stdout: (msg) => {
          this.stdout = msg;
        }
      });
      // await PyodideLoader.pyodide.loadPackage("micropip");
      // const micropip = PyodideLoader.pyodide.pyimport("micropip");
    }
    return PyodideLoader.pyodide;
  }
}

PyodideLoader.getPyodide().then(async (pyodide) => {
  globalThis.postMessage({ value: { ready: true, language: "python" }, id: "", type: "system" });

  globalThis.addEventListener("message", async (ev: MessageEvent<MessagePayload<any>>) => {
    if (ev.data && ev.data.value.code && ev.data.value.language === "python") {
      try {
        const preMessage: MessagePayload<any> = {
          id: ev.data.id,
          err: null,
          value: {
            stage: "running"
          },
          type: "system"
        };
        globalThis.postMessage(preMessage);
      
        await pyodide.runPythonAsync(ev.data.value.code);
        const v = PyodideLoader.stdout;
        const postSysMessage = {
          id: ev.data.id,
          err: null,
          value: {
            stage: "exit"
          },
          type: "system"
        };
        globalThis.postMessage(postSysMessage);

        const postAppMessage = {
          id: ev.data.id,
          err: null,
          value: v,
          type: "application"
        };
        globalThis.postMessage(postAppMessage);

      } catch (error) {
        const message: MessagePayload<any> = {
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
