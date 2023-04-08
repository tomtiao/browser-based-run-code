import { useCallback, useEffect, useId, useState } from "react";
import { MessagePayload, SupportedLanguage, WorkerManager, supportedLanguageList } from "./worker";
import Editor from "./components/Editor";
import Preview from "./components/Preview";

const workerManager = WorkerManager.instance();
// preload cpp worker
workerManager.getWorker("cpp");

function App() {
  const id = useId();

  const [language, setLanguage] = useState<SupportedLanguage>("python");
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(false);

  const [output, setOutput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    setLoading(true);

    let dropped = false;
    (async () => {
      try {
        const worker = await workerManager.getWorker(language)
        setWorker(worker);
      } catch (err) {
        // TODO: handle error
        console.error(err);
      } finally {
        if (!dropped) {
          setLoading(false);
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
        setLoading(false);

        if (ev.data.err) {
          console.error(ev.data.id, ev.data.err);
          return;
        }

        setOutput("");

        if (ev.data.type === "application") {
          setOutput(ev.data.value as string);
        } else {
          if (ev.data.value.isHTML) {
            setPreviewUrl(ev.data.value.url);
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
      setLoading(true);
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

  return (
    <>
      <Editor
        key="editor"
        onRunCode={handleRunCode}
        onLanguageChange={handleLanguageChange}
        supportedLanguageList={supportedLanguageList}
        currentLanguage={language}
        loading={loading}
      />
      <div className="status">
        {loading ? "Loading..." : "Idle"}
      </div>
      <div className="output">
        {output}
      </div>
      {/* <Preview previewUrl={previewUrl}/> */}
    </>
  );
}

export default App;
