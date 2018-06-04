import * as React from "react"
import { render } from "react-dom"
import { Demo } from "./demo"
import { FocusStyleManager } from "@blueprintjs/core"

import "@blueprintjs/core/lib/css/blueprint.css"
import "@blueprintjs/icons/lib/css/blueprint-icons.css"

FocusStyleManager.onlyShowFocusOnTabs()

render(<Demo />, document.getElementById("root"))
