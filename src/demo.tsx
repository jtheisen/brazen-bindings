import { BindingContext } from "./bindings";
import * as React from "react";
import { observer } from "mobx-react";
import { defineBinding, Workbench } from "./demo-components";

const context = new BindingContext();

const NumberWorkbench = Workbench.ofType<number>();
const StringWorkbench = Workbench.ofType<string>();

function nonEmpty(value: string) {
  return value ? undefined : "value should not be empty";
}

@observer
class ValidationDisplay extends React.Component<{ context: BindingContext }> {
  render() {
    const isValid = this.props.context.isValid;
    return isValid ? (
      <div className="pt-callout pt-intent-success pt-icon-tick">
        All is well.
      </div>
    ) : (
      <div className="pt-callout pt-intent-warning pt-icon-warning-sign">
        There are some issues.
      </div>
    );
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
        <StringWorkbench
          title="Immediate"
          context={context}
          definition={defineBinding("", source => source)}
        />
        <StringWorkbench
          title="Deferred"
          context={context}
          definition={defineBinding("", source => source.defer())}
        />
        <StringWorkbench
          title="Nonempty immediate"
          context={context}
          definition={defineBinding("", source => source.validate(nonEmpty))}
        />
        <StringWorkbench
          title="Nonempty deferred"
          context={context}
          definition={defineBinding("", source =>
            source.validate(nonEmpty).defer()
          )}
        />
        {/* <StringWorkbench title="No empty strings"
                default={""}
                makeBinding={source => source
                    .validate(s => s ? undefined : "Field can't be empty.")
                    .buffer()}
            /> */}

        <NumberWorkbench
          title="Example 1"
          context={context}
          definition={defineBinding(42, source =>
            source
              .fromNumber()
              .validate(
                v => (v.length === 2 ? "not 2 chars please" : undefined)
              )
          )}
        />
      </div>
    );
  }
}
