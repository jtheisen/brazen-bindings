import { BindingContext } from "./bindings"
import * as React from "react"
import { observer } from "mobx-react"
import { defineBinding, Workbench } from "./demo-components"
import * as pt from "@blueprintjs/core"

const context = new BindingContext()

const NumberWorkbench = Workbench.ofType<number>()
const StringWorkbench = Workbench.ofType<string>()

function nonEmpty(value: string) {
  return value.trim() ? undefined : "value should not be empty"
}

@observer
class ValidationDisplay extends React.Component<{ context: BindingContext }> {
  render() {
    const isValid = this.props.context.isValid
    return isValid ? (
      <div className="pt-callout pt-intent-success pt-icon-tick">
        All is well.
      </div>
    ) : (
      <div className="pt-callout pt-intent-warning pt-icon-warning-sign">
        There are some issues.
      </div>
    )
  }
}

@observer
export class Demo extends React.Component {
  public render() {
    return (
      <div style={{ marginTop: 50 }}>
        <ValidationDisplay context={context} />
        <div>
          <button
            className="pt-button pt-minimal"
            onClick={() => context.validateAll()}
          >
            validate
          </button>
        </div>

        <pt.Tabs
          id="SampleTabs"
          vertical={true}
          renderActiveTabPanelOnly={true}
        >
          <pt.Tab
            id="immediate"
            children="immediate"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.validate(nonEmpty)
                )}
              />
            }
          />
          <pt.Tab
            id="deferred"
            children="deferred"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.validate(nonEmpty).defer()
                )}
              />
            }
          />
          <pt.Tab
            id="hybrid"
            children="hybrid"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.defer().validate(nonEmpty)
                )}
              />
            }
          />
          <pt.Tab
            id="initially-invalid"
            children="initially invalid"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.validate(nonEmpty).validateInitially()
                )}
              />
            }
          />
          <pt.Tab
            id="numbers"
            children="numbers"
            panel={
              <NumberWorkbench
                context={context}
                definition={defineBinding(42, source =>
                  source
                    .fromNumber()
                    .validate(
                      v => (v.length === 2 ? "not 2 chars please" : undefined)
                    )
                )}
              />
            }
          />
        </pt.Tabs>
      </div>
    )
  }
}
