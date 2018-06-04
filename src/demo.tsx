import { BindingContext } from "./bindings"
import { floatConverter } from "./conversions"
import * as React from "react"
import { observable } from "mobx"
import { observer } from "mobx-react"
import { defineBinding, Workbench, DependencyDemo } from "./demo-components"
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
  @observable renderActiveTabPanelOnly = true

  public render() {
    return (
      <div style={{ marginTop: 20 }}>
        <ValidationDisplay context={context} />
        <div />
        <div
          style={{
            display: "flex",
            margin: "10px 0 10px 0",
            paddingBottom: 5,
            alignItems: "baseline",
            borderBottom: "1px solid gray"
          }}
        >
          <pt.Checkbox
            label="Render active tab only"
            checked={this.renderActiveTabPanelOnly}
            onChange={e =>
              (this.renderActiveTabPanelOnly = e.currentTarget.checked)
            }
          />
          <div style={{ flexGrow: 5 }} />
          <button className="pt-button" onClick={() => context.validateAll()}>
            validate
          </button>
        </div>
        <pt.Tabs
          id="SampleTabs"
          vertical={true}
          renderActiveTabPanelOnly={this.renderActiveTabPanelOnly}
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
            id="bar"
            children="barred"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.bar().validate(nonEmpty)
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
                    .convert(floatConverter)
                    .validate(
                      v => (v.length === 2 ? "not 2 chars please" : undefined)
                    )
                )}
              />
            }
          />
          <pt.Tab
            id="dependencies"
            children="dependencies"
            panel={<DependencyDemo context={context} />}
          />
          <pt.Tab
            id="fix"
            children="fixed"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.fix(s => s.toUpperCase())
                )}
              />
            }
          />
        </pt.Tabs>
      </div>
    )
  }
}
