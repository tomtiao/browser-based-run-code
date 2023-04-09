import { useCallback, useEffect, useId, useState } from "react";
import { MessagePayload, SupportedLanguage, WorkerManager, supportedLanguageList } from "./worker";
import Editor from "./components/Editor";
import Preview from "./components/Preview";

const workerManager = WorkerManager.instance();

type AppState =
  | "idle"
  | "loading"
  | "compiling"
  | "running"

function App() {
  const id = useId();

  const [language, setLanguage] = useState<SupportedLanguage>("python");
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
        worker = await workerManager.getWorker(language);
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
          console.error(ev.data.id, ev.data.err);
          return;
        }

        if (ev.data.type === "application") {
          setOutput(ev.data.value as string);
        } else {
          if (ev.data.value.stage) {
            switch (ev.data.value.stage) {
              case "running": {
                setCurrentState("running")
              } break;
              case "compilation": {
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

  const handleRunCode = useCallback(
    async (code: string) => {
      setCurrentState("compiling");
      const message: MessagePayload = {
        id: id,
        type: "system",
        value: {
          code,
          language
        },
        err: null
      };
      worker!.postMessage(message);
    },
    [worker]
  );

  const handleLanguageChange = (newLanguage: string) => {
    // TODO: check newLanguage is SupportedLanguage
    setLanguage(newLanguage as SupportedLanguage);
  };

  const currentStatus = (
    currentState === "loading"
      ? "Loading..."
      : (
        currentState === "compiling"
          ? "Compiling..."
          : (
            currentState === "running"
              ? "Running..."
              : "Idle"
          )
      )
  );

  return (
    <>
      <Editor
        key="editor"
        onRunCode={handleRunCode}
        onLanguageChange={handleLanguageChange}
        supportedLanguageList={supportedLanguageList}
        currentLanguage={language}
        ready={currentState === "idle"}
      />
      <div className="status">
        {currentStatus}
      </div>
      <div className="output">
        {output}
      </div>
      {/* <Preview previewUrl={previewUrl}/> */}
    </>
  );
}

export default App;
