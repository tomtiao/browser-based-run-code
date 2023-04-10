import * as monaco from "monaco-editor";
import {
  type RefObject,
  type MouseEventHandler,
  type ChangeEventHandler,
  useRef,
  useEffect,
} from "react";

import { Button, Dropdown, DropdownProps, Input, Label, Option, Body1Stronger } from "@fluentui/react-components";

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
  const divRef = useRef<HTMLDivElement | null>(null);
  const [editorInstance] = useEditor(divRef, options);

  useEffect(() => {
    if (!editorInstance) {
      return;
    }

    const handleResize = () => {
      editorInstance.layout();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [editorInstance]);

  const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
    const code = editorInstance!.getValue();
    onRunCode(code);
  };

  const handleLanguageChange: DropdownProps['onOptionSelect'] = (ev, data) => {
    const languageType = data.optionValue!;
    // TODO: check ev.target.value is SupportedLanguage
    editorInstance!.setValue(prefilled[languageType as keyof typeof prefilled]);
    monaco.editor.setModelLanguage(editorInstance!.getModel()!, supportedLanguageMap[languageType]);
    onLanguageChange(languageType);
  };

  const handleOptionInputChange: ChangeEventHandler<HTMLInputElement> = (ev) => {
    onCompileOptionChange(ev.target.value);
  };

  const runButtonString = (
    hasCompileOption
    ? "编译并执行"
    : "执行"
  );

  return (
    <div className="editor-wrapper">
      <div className="control">
        <div className="line">
          <div className="language-select-wrapper">
            <Label htmlFor="language-select" className="option-label">
              <Body1Stronger>语言</Body1Stronger>
            </Label>
            <Dropdown
              name="language-select"
              onOptionSelect={handleLanguageChange}
              value={currentLanguage}
              title="选择语言"
            >
              {Object.entries(supportedLanguageMap).map(([languageType]) => (
                <Option value={languageType} key={languageType}>{languageType}</Option>
              ))}
            </Dropdown>
          </div>
        </div>
        {
          hasCompileOption
          ? (
            <div className="line">
              <div className="compiler-option-wrapper">
                <Label htmlFor="compiler-option-input" className="option-label">
                  <Body1Stronger>编译选项</Body1Stronger>
                </Label>
                <Input
                  type="text"
                  id="compiler-option-input"
                  onChange={handleOptionInputChange}
                  value={compileOption}
                />
              </div>
            </div>
          ) : null
        }
        <Button onClick={handleClick} appearance="primary" disabled={!ready}>{runButtonString}</Button>
      </div>
      <div ref={divRef} className="editor" />
    </div>
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
