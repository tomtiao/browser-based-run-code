import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Spinner, PresenceBadge, Subtitle2, Title3 } from "@fluentui/react-components";

import { MessagePayload, SupportedLanguage, languageCompileOptionMap, languageOutputTypeMap, supportedLanguageMap } from "./worker";
import Editor from "./components/Editor";
import Preview, { PreviewOutputType } from "./components/Preview";

import { workerManager } from "./worker";

import "./App.css";

type AppState =
  | "idle"
  | "loadingModule"
  | "compiling"
  | "running"

function App() {
  const id = useId();

  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [compileOption, setCompileOption] = useState("-O0");
  const [currentState, setCurrentState] = useState<AppState>("idle");

  const [output, setOutput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const [worker, setWorker] = useState<Worker | null>(null);

  useEffect(() => {
    setCurrentState("loadingModule");

    let dropped = false;
    (async () => {
      let worker: Worker;
      try {
        worker = await workerManager.getWorker(supportedLanguageMap[language]);
      } catch (err) {
        // TODO: handle error
        console.error(err);
      } finally {
        if (!dropped) {
          setWorker(worker!);
          console.log(language, "loaded");

          set_canvas: {
            if (offscreenCanvasRef.current.inited) {
              break set_canvas;
            }
            if (languageOutputTypeMap[language] !== "canvas") {
              break set_canvas;
            }
        
            const offscreenCanvas = offscreenCanvasRef.current.canvas!;
            const message: MessagePayload<{ type: "set_canvas", data: OffscreenCanvas; }> = {
              id: "",
              type: "system",
              value: {
                type: "set_canvas",
                data: offscreenCanvas
              },
              err: null
            };
            worker!.postMessage(message, [offscreenCanvas]);
        
            offscreenCanvasRef.current.inited = true;
          }

          setCurrentState("idle");
        }
      }
    })();

    return () => {
      dropped = true;
    };
  }, [language]);

  useEffect(() => {
    if (!worker) {
      return;
    }

    let dropped = false;
    let url = "";
    const handleMessage = (ev: MessageEvent<MessagePayload<any>>) => {
      if (dropped) {
        return;
      }
      if (ev.data) {
        if (ev.data.err) {
          setCurrentState("idle");
          console.error(ev.data.id, "\n", ev.data.err);
          const errMessage = ev.data.err.message;
          setOutput((output) => output + '\n' + errMessage);
          return;
        }

        if (ev.data.type === "application") {
          console.log(ev.data.value)
          setOutput((output) => output + ev.data.value);
        } else {
          if (ev.data.value.stage) {
            switch (ev.data.value.stage) {
              case "running": {
                setOutput("");
                setCurrentState("running");
              } break;
              case "compilation": {
                setOutput("");
                setCurrentState("compiling");
              } break;
              case "exit": {
                setCurrentState("idle");
              } break;
              default: {
                console.error(ev.data.value.stage, "not implemented");
              } break;
            }
          } else if (ev.data.value.type) {
            switch (ev.data.value.type) {
              case "stdin_request": {
                const s = prompt() ?? "";

                workerManager.responseWorkerInput(worker, s);
              } break;
              case "plot_show": {
                url = URL.createObjectURL(
                  new Blob([ev.data.value.data.buffer], { type: "image/png" })
                );
                setPreviewUrl(url);
              } break;
            }
          }
        }
      }
    };
    worker.addEventListener("message", handleMessage);

    return () => {
      dropped = true;
      worker.removeEventListener("message", handleMessage);
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [worker]);

  const hasCompileOption = languageCompileOptionMap[language];

  const handleRunCode = useCallback(
    async (code: string) => {
      if (currentState !== "idle") {
        return;
      }
      if (!worker) {
        console.warn("no worker available, will not run code");
        return;
      }
      setCurrentState("compiling");
      const message: MessagePayload = {
        id: id,
        type: "system",
        value: {
          code,
          language,
          compileOption: hasCompileOption ? compileOption : undefined
        },
        err: null
      };
      worker.postMessage(message);
    },
    [worker, currentState, language, id, hasCompileOption, compileOption]
  );

  const handleLanguageChange = (newLanguage: string) => {
    // if (worker) {
    //   workerManager.destroyWorker(language);
    // }
    // TODO: check newLanguage is SupportedLanguage
    setLanguage(newLanguage as SupportedLanguage);
  };

  const handleCompileOptionChange = (option: string) => {
    setCompileOption(option);
  };

  const currentStatus = (
    currentState === "loadingModule"
      ? "加载中…"
      : (
        currentState === "compiling"
          ? "正在编译…"
          : (
            currentState === "running"
              ? "运行中…"
              : "就绪"
          )
      )
  );

  const outputType: PreviewOutputType = [
    "string",
    languageOutputTypeMap[language]
  ];

  const offscreenCanvasRef = useRef<{ canvas: OffscreenCanvas | null; inited: boolean; }>({ canvas: null, inited: false });
  const handleCanvasReady = (canvas: HTMLCanvasElement) => {
    if (offscreenCanvasRef.current.canvas === null) {
      const offscreenCanvas = canvas.transferControlToOffscreen();
      offscreenCanvasRef.current.canvas = offscreenCanvas;
    }
  };

  return (
    <div className="app-wrapper">
      <nav className="navigation">
        <Title3 className="page-title">应用执行</Title3>
      </nav>
      <main className="content-wrapper">
        <div className="editor-status">
          <div className="editor-container">
            <Editor
              key="editor"
              onRunCode={handleRunCode}
              currentLanguage={language}
              onLanguageChange={handleLanguageChange}
              supportedLanguageMap={supportedLanguageMap}
              ready={currentState === "idle"}
              hasCompileOption={hasCompileOption}
              compileOption={compileOption}
              onCompileOptionChange={handleCompileOptionChange}
            />
          </div>
          <div className="status">
            {
              currentState === "idle"
              ? (
                <>
                  <PresenceBadge size="large" className="indicator" />
                  <Subtitle2 align="center">{currentStatus}</Subtitle2>
                </>
              )
              : (
                <Spinner appearance="primary" label={currentStatus} />
              )
            }
          </div>
        </div>
        <div className="preview-wrapper">
          <Preview
            outputType={outputType}
            output={output}
            previewImageUrl={previewUrl}
            onCanvasReady={handleCanvasReady}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
