import { type PyodideInterface } from "pyodide";
import { type PyBufferView, type PyBuffer } from "pyodide/ffi";
import { MessagePayload } from ".";

class PyodideLoader {
  static pyodide: PyodideInterface;

  static async getPyodide() {
    if (!PyodideLoader.pyodide) {
      const { loadPyodide } = await import("pyodide/pyodide.js");
      PyodideLoader.pyodide = await loadPyodide({
        indexURL: "./lib/pyodide",
      });
    }
    return PyodideLoader.pyodide;
  }
}

const globalRenderResultVar = "plot_render_result";
const renderImageFormat = "png";
const patchMatplotlibShow = `import os
import base64
from io import BytesIO

# before importing matplotlib
# to avoid the wasm backend (which needs "js.document", not available in worker)
os.environ["MPLBACKEND"] = "AGG"

import matplotlib.pyplot

_old_show = matplotlib.pyplot.show
assert _old_show, "matplotlib.pyplot.show"

${globalRenderResultVar} = b''
def show(*, block=None):
    buf = BytesIO()
    matplotlib.pyplot.savefig(buf, format="${renderImageFormat}")
    buf.seek(0)
    global ${globalRenderResultVar}
    ${globalRenderResultVar} = buf.read()
    matplotlib.pyplot.clf()

matplotlib.pyplot.show = show
`;

const testPlot = `import matplotlib
import numpy as np
import matplotlib.cm as cm
from matplotlib import pyplot as plt
delta = 0.025
x = y = np.arange(-3.0, 3.0, delta)
X, Y = np.meshgrid(x, y)
Z1 = np.exp(-(X**2) - Y**2)
Z2 = np.exp(-((X - 1) ** 2) - (Y - 1) ** 2)
Z = (Z1 - Z2) * 2
plt.figure()
plt.imshow(
Z,
interpolation="bilinear",
cmap=cm.RdYlGn,
origin="lower",
extent=[-3, 3, -3, 3],
vmax=abs(Z).max(),
vmin=-abs(Z).max(),
)
plt.show()`;

let inputBufferArray: Int32Array;
PyodideLoader.getPyodide().then(async (pyodide) => {
  await PyodideLoader.pyodide.loadPackage("micropip");
  const micropip = PyodideLoader.pyodide.pyimport("micropip");
  await micropip.install("matplotlib");
  await pyodide.runPythonAsync(patchMatplotlibShow);

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

        const plotBufferProxy: PyBuffer = pyodide.globals.get(globalRenderResultVar);
        const plotBufferView: PyBufferView = plotBufferProxy.getBuffer();
        console.log('plot buffer len', plotBufferView.nbytes);
        if (plotBufferView.nbytes > 0) {
          // called `plt.show()`
          const resultData = plotBufferProxy.toJs();
          globalThis.postMessage({
            id: ev.data.id,
            value: {
              type: "plot_show",
              data: resultData
            },
            type: "system"
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
          }, [resultData.buffer]);

          plotBufferProxy.destroy();
          plotBufferView.release();

          // TODO: 有没有更好的办法重置缓冲区
          await pyodide.runPythonAsync(`${globalRenderResultVar} = b''`);
        }
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
