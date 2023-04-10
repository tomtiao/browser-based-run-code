import { createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FluentProvider, teamsLightTheme } from "@fluentui/react-components";

let div;
if ((div = document.getElementById("root"))) {
  const root = createRoot(div);
  root.render(
    createElement(
      FluentProvider,
      {
        theme: teamsLightTheme,
        className: "fluentUI-root"
      },
      createElement(App)
    )
  );
} else {
  throw new TypeError("unable to find element");
}
