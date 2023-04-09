import * as monaco from "monaco-editor";
import {
  type RefObject,
  type MouseEventHandler,
  type ChangeEventHandler,
  useRef,
  useState,
  useEffect,
} from "react";

import { throttle } from "../utils";

import "./Editor.css";

const prefilled = {
  python: ["def x():", '\tprint("Hello world!")', 'x()'].join("\n"),
  cpp: [
    "#include <iostream>",
    "",
    'int main() {',
    '    std::cout << "Hello World!\\n";',
    "}"
  ].join("\n"),
  c: [
    "#include <stdio.h>",
    "",
    'int main() {',
    '    printf("Hello World!\\n");',
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
  supportedLanguageMap,
  currentLanguage,
  ready,
  hasCompileOption,
  compileOption,
  onCompileOptionChange
}: {
  onRunCode: (code: string) => void;
  onLanguageChange: (newLanguage: string) => void;
  supportedLanguageMap: Readonly<Record<string, string>>;
  currentLanguage: string;
  ready: boolean;
  hasCompileOption: boolean;
  compileOption: string;
  onCompileOptionChange: (option: string) => void;
}) {
  const [_initialized, setInitialized] = useState(false);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [editorInstance] = useEditor(divRef, options);

  useEffect(() => {
    if (!editorInstance) {
      return;
    }

    const handleResize = throttle(() => {
      editorInstance.layout();
    });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [editorInstance]);

  const handleRefChange: React.LegacyRef<HTMLDivElement> = (node) => {
    divRef.current = node;
    setInitialized(true);
  };

  const handleClick: MouseEventHandler<HTMLButtonElement> = (_ev) => {
    const code = editorInstance!.getValue();
    onRunCode(code);
  };

  const handleLanguageChange: ChangeEventHandler<HTMLSelectElement> = (ev) => {
    const languageType = ev.target.value;
    // TODO: check ev.target.value is SupportedLanguage
    editorInstance!.setValue(prefilled[languageType as keyof typeof prefilled]);
    monaco.editor.setModelLanguage(editorInstance!.getModel()!, supportedLanguageMap[languageType]);
    onLanguageChange(ev.target.value);
  };

  const handleOptionInputChange: ChangeEventHandler<HTMLInputElement> = (ev) => {
    onCompileOptionChange(ev.target.value);
  };

  return (
    <>
      <div ref={handleRefChange} className="editor" />
      <div className="control">
        <div className="language-select-wrapper">
          <label htmlFor="language-select">语言：</label>
          <select
            name="language-select"
            onChange={handleLanguageChange}
            value={currentLanguage}
            title="选择语言"
          >
            {Object.entries(supportedLanguageMap).map(([languageType]) => (
              <option value={languageType} key={languageType}>{languageType}</option>
            ))}
          </select>
        </div>
        {
          hasCompileOption
          ? (
            <div className="compiler-option-wrapper">
              <label htmlFor="compiler-option">编译选项：</label>
              <input
                type="text"
                name="compiler-option"
                onChange={handleOptionInputChange}
                value={compileOption}
              />
            </div>
          ) : null
        }
        <button onClick={handleClick} disabled={!ready}>执行</button>
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
