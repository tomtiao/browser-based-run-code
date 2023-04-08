import { createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

let div;
if ((div = document.getElementById("root"))) {
  const root = createRoot(div);
  root.render(createElement(App));
} else {
  throw new TypeError("unable to find element");
}
