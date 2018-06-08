import { bind } from "../brazen-bindings/bindings"
import * as React from "react"
import { observable } from "mobx"
import { BindingContext } from "../brazen-bindings"
import { MyInput, Rendering } from "./demo-components"

export class DependencyDemo extends React.Component<{
  context: BindingContext
}> {
  @observable value1 = ""
  @observable value2 = ""

  render() {
    return (
      <div className="workbench">
        <div>
          <MyInput label="Value 1" binding={bind(this, "value1")} />
          <MyInput
            label="Value 2"
            binding={bind(this, "value2").validate(
              v =>
                v.length > this.value1.length
                  ? "value 2 must not be longer than value 1"
                  : undefined
            )}
          />
          <Rendering render={() => <div>{this.value2}</div>} />
        </div>
        <div>
          <pre>
            <code>{`ctx.bind(model, "val2")
    .validate(v =>
    v.length > model.val1.length
      ? "value 2 must not be"
        + "longer than value 1"
      : undefined
    )
  `}</code>
          </pre>
        </div>
        <div>
          <blockquote>
            Writing ad-hoc validation code depending on sources other than the
            one currently bound against is easy. Note how the second field's
            error status updates even when the first field is edited: That's
            because the validator is evaluated within a mobx computation also.
          </blockquote>
        </div>
      </div>
    )
  }
}
