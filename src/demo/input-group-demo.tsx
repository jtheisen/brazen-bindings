import * as React from "react"
import { BoundInputGroup, Rendering } from "./demo-components"
import { BindingContext, bind } from "../brazen-bindings/bindings"
import { observable } from "mobx"
import * as pt from "@blueprintjs/core"

export class InputGroupDemo extends React.Component<{
  context: BindingContext
}> {
  @observable value = ""

  render() {
    return (
      <div className="workbench">
        <div style={{ width: 250 }}>
          <pt.FormGroup label="Edit value">
            <BoundInputGroup
              binding={bind(this, "value")
                .validate(
                  "value should not be empty",
                  s => s && s.trim() !== ""
                )
                .validateInitially()}
            />
          </pt.FormGroup>
          <label className="pt-label pt-disabled" style={{ marginTop: 20 }}>
            Source
            <Rendering
              render={() => (
                <input
                  disabled={true}
                  className="pt-input"
                  value={this.value + ""}
                  style={{ width: "100%" }}
                />
              )}
            />
          </label>
        </div>
        <div />
        <div>
          <blockquote>
            Another way of styling the blueprint input group: Error messages are
            displayed in a tooltip over a warning sign. This approach doesn't
            need empty space anywhere to be reserved for the error message.
          </blockquote>
        </div>
      </div>
    )
  }
}
