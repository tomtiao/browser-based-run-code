import { useCallback, useEffect, useId, useState } from "react";
import { MessagePayload, SupportedLanguage, WorkerManager, languageCompileOptionMap, supportedLanguageMap } from "./worker";
import Editor from "./components/Editor";
import Preview from "./components/Preview";

const workerManager = WorkerManager.instance();
// preload worker
workerManager.getWorker("cpp");
workerManager.getWorker("python");

type AppState =
  | "idle"
  | "loading"
  | "compiling"
  | "running"

function App() {
  const id = useId();

  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [compileOption, setCompileOption] = useState("-O0");
  const [worker, setWorker] = useState<Worker | null>(null);
  const [currentState, setCurrentState] = useState<AppState>("idle");

  const [output, setOutput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    setCurrentState("loading");

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
    const handleMessage = (ev: MessageEvent<MessagePayload<any>>) => {
      if (dropped) {
        return;
      }
      if (ev.data) {
        if (ev.data.err) {
          setCurrentState("idle");
          console.error();
          console.error(ev.data.id, "\n", ev.data.err);
          setOutput(ev.data.err.message);
          return;
        }

        if (ev.data.type === "application") {
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
          }
        }
      }
    };
    worker.addEventListener("message", handleMessage);

    return () => {
      dropped = true;
      worker.removeEventListener("message", handleMessage);
    };
  }, [worker]);

  const hasCompileOption = languageCompileOptionMap[language];

  const handleRunCode = useCallback(
    async (code: string) => {
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
    [worker, language, id, hasCompileOption, compileOption]
  );

  const handleLanguageChange = (newLanguage: string) => {
    // TODO: check newLanguage is SupportedLanguage
    setLanguage(newLanguage as SupportedLanguage);
  };

  const handleCompileOptionChange = (option: string) => {
    setCompileOption(option);
  };

  const currentStatus = (
    currentState === "loading"
      ? "加载中…"
      : (
        currentState === "compiling"
          ? "正在编译…"
          : (
            currentState === "running"
              ? "运行中…"
              : "空闲"
          )
      )
  );

  return (
    <>
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
      <div className="status">
        {currentStatus}
      </div>
      <Preview output={output} />
    </>
  );
}

export default App;
