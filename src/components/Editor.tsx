import * as monaco from "monaco-editor";
import {
  type RefObject,
  type MouseEventHandler,
  type ChangeEventHandler,
  useRef,
  useEffect,
} from "react";

import { Button, Dropdown, DropdownProps, Input, Label, Option, Body1Stronger } from "@fluentui/react-components";

import "./Editor.css";
import { SupportedLanguage, languageLabelMap } from "../worker";

const prefilled = {
  // python: ["def x():", '\tprint("Hello world!")', 'x()'].join("\n"),
  python: `import matplotlib
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
plt.show()`,
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
    prefilled.python,
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

  const editorLayoutRef = useRef<ReturnType<typeof window['requestAnimationFrame']> | null>(null);

  useEffect(() => {
    if (!editorInstance) {
      return;
    }

    editorLayoutRef.current = requestAnimationFrame(function layoutEditor() {
      editorInstance.layout();
      editorLayoutRef.current = requestAnimationFrame(layoutEditor);
    });

    return () => {
      if (!editorLayoutRef.current) {
        return;
      }
      cancelAnimationFrame(editorLayoutRef.current);
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
              value={languageLabelMap[currentLanguage as SupportedLanguage]}
              title="选择语言"
            >
              {Object.entries(supportedLanguageMap).map(([languageType]) => (
                <Option value={languageType} key={languageType}>{languageLabelMap[languageType as SupportedLanguage]}</Option>
              ))}
            </Dropdown>
          </div>
        </div>
        {
          hasCompileOption
            && (
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
            )
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
