import { useRef } from "react";

import "./Preview.css";

const Preview = ({
    previewUrl = ""
}: {
    previewUrl?: string;
}) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    return (
        <div className="preview">
            <iframe
                ref={iframeRef}
                src={previewUrl ? previewUrl : "about:blank"}
            />
        </div>
    )
};

export default Preview;