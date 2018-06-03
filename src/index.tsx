import * as React from "react";
import { render } from "react-dom";
import { Demo } from "./demo";

import "@blueprintjs/core/lib/css/blueprint.css";

const App = () => (
  <div>
    <Demo />
  </div>
);

render(<App />, document.getElementById("root"));
