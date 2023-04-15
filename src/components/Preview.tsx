import { type RefObject, useRef, useEffect, useCallback } from "react";

import { type ITerminalInitOnlyOptions, type ITerminalOptions, Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebglAddon } from "xterm-addon-webgl";
import { CanvasAddon } from "xterm-addon-canvas";
import "xterm/css/xterm.css";

import { Image } from "@fluentui/react-components";

import "./Preview.css";

const options: ITerminalOptions & ITerminalInitOnlyOptions = {
    convertEol: true,
    theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
    },
};

const canvasOptions = {
    width: 300,
    height: 300
};

export type PreviewOutputType = ("string" | "canvas" | "image")[];

const Preview = ({
    output = "",
    previewImageUrl = "",
    outputType = ["string"],
    onCanvasReady
}: {
    output?: string;
    previewImageUrl?: string;
    outputType?: PreviewOutputType;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}) => {
    const divRef = useRef<HTMLDivElement | null>(null);
    const [terminalInstance, fitAddonInstance] = useTerminal(divRef, options);

    const canvasMeasuredRef = useCallback((canvas: HTMLCanvasElement | null) => {
        onCanvasReady?.(canvas);
    }, [onCanvasReady]);
    const [canvas] = useCanvas(canvasMeasuredRef, canvasOptions);

    const fitRef = useRef<ReturnType<typeof window['requestAnimationFrame']> | null>(null);
    useEffect(() => {
        if (!terminalInstance || !fitAddonInstance) {
            return;
        }

        fitRef.current = requestAnimationFrame(function fitTerminal() {
            fitAddonInstance.fit();
            requestAnimationFrame(fitTerminal);
        });

        return () => {
            if (!fitRef.current) {
                return;
            }
            cancelAnimationFrame(fitRef.current);
        };
    }, [terminalInstance, fitAddonInstance]);

    useEffect(() => {
        if (!terminalInstance) {
            return;
        }

        terminalInstance.reset();
        terminalInstance.write(output);
    }, [terminalInstance, output]);

    return (
        <div className="preview">
            {outputType.includes("string") && <div className="text-output" ref={divRef} />}
            <div
                className="graph-output-canvas graph-output"
                style={{ display: outputType.includes("canvas") ? "inherit" : "none" }}
            >
                {canvas}
            </div>
            {
                outputType.includes("image") && (
                    <div className="graph-output-image graph-output">
                        <Image src={previewImageUrl} className="output-image" />
                    </div>
                )
            }
        </div>
    )
};

const useTerminal = (
    divRef: RefObject<HTMLDivElement>,
    options?: ITerminalOptions & ITerminalInitOnlyOptions
): [Terminal | null, FitAddon | null] => {
    const terminalRef = useRef<Terminal | null>(null);
    const terminalFitAddonRef = useRef<FitAddon | null>(null);

    if (!divRef.current) {
        return [null, null];
    }

    if (terminalRef.current === null) {
        terminalRef.current = new Terminal(options);
        terminalFitAddonRef.current = new FitAddon();
        terminalRef.current.loadAddon(terminalFitAddonRef.current);

        terminalRef.current.open(divRef.current);

        try {
            const webglAddon = new WebglAddon();

            // handle WebGL context loss
            webglAddon.onContextLoss(() => {
                webglAddon.dispose();
            });
            terminalRef.current.loadAddon(webglAddon);
        } catch (e) {
            // load canvas as fallback if webgl is not available
            terminalRef.current.loadAddon(new CanvasAddon());
        }

        terminalFitAddonRef.current.fit();
    }

    return [terminalRef.current, terminalFitAddonRef.current];
}

const useCanvas = (
    measuredRef: (canvas: HTMLCanvasElement) => void,
    options: { width?: number; height?: number; } = {}
) => {
    const { width = 400, height = 300 } = options;
    return [(
        <canvas
            key="canvas"
            width={width}
            height={height}
            ref={measuredRef}
        />
    )];
};

export default Preview;