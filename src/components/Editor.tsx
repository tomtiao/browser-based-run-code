import * as monaco from "monaco-editor";
import {
  type RefObject,
  type MouseEventHandler,
  type ChangeEventHandler,
  useRef,
  useState,
} from "react";

import "./Editor.css";

const prefilled = {
  python: ["def x():", '\tprint("Hello world!")', 'x()'].join("\n"),
  cpp: [
    "#include <iostream>",
    "",
    'int main() {',
    '    std::cout << "Hello World!\\n";',
    "}"
  ].join("\n")
} as const;

const options = {
  model: monaco.editor.createModel(
    ["def x():", '\tprint("Hello world!")', 'x()'].join("\n"),
    "python"
  ),
  theme: "vs-dark",
};

function Editor({
  onRunCode,
  onLanguageChange,
  supportedLanguageList,
  currentLanguage,
  loading
}: {
  onRunCode: (code: string) => void;
  onLanguageChange: (newLanguage: string) => void;
  supportedLanguageList: Readonly<string[]>;
  currentLanguage: string;
  loading: boolean;
}) {
  const [_initialized, setInitialized] = useState(false);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [editorInstance] = useEditor(divRef, options);

  const handleRefChange: React.LegacyRef<HTMLDivElement> = (node) => {
    divRef.current = node;
    setInitialized(true);
  };

  const handleClick: MouseEventHandler<HTMLButtonElement> = (_ev) => {
    const code = editorInstance!.getValue();
    onRunCode(code);
  };

  const handleLanguageChange: ChangeEventHandler<HTMLSelectElement> = (ev) => {
    const editorModel = editorInstance!.getModel()!;
    const language = ev.target.value;
    monaco.editor.setModelLanguage(editorModel, language);
    // TODO: check ev.target.value is SupportedLanguage
    editorModel.setValue(prefilled[language as keyof typeof prefilled]);
    onLanguageChange(ev.target.value);
  };

  return (
    <>
      <div ref={handleRefChange} className="editor" />
      <div className="control">
        <select onChange={handleLanguageChange} value={currentLanguage}>
          {supportedLanguageList.map((language) => (
            <option value={language} key={language}>{language}</option>
          ))}
        </select>
        <button onClick={handleClick} disabled={loading}>Run</button>
      </div>
    </>
  );
}

function useEditor(
  divRef: RefObject<HTMLDivElement>,
  options?: monaco.editor.IStandaloneEditorConstructionOptions
) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  if (!divRef.current) {
    return [null];
  }

  if (editorRef.current === null) {
    editorRef.current = monaco.editor.create(divRef.current, options);
  }

  return [editorRef.current];
}

export default Editor;
