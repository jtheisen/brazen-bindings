import * as React from "react";
import { render } from "react-dom";
import { Demo } from "./demo";

const App = () => (
  <div>
    <Demo />
  </div>
);

render(<App />, document.getElementById("root"));
