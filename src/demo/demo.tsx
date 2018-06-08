import {
  BindingContext,
  floatConverter,
  BindingErrorLevel
} from "../brazen-bindings"
import * as React from "react"
import { observable } from "mobx"
import { observer } from "mobx-react"
import { defineBinding, Workbench } from "./demo-components"
import { DependencyDemo } from "./dependency-demo"
import { makeValidator } from "../brazen-bindings/validators"
import * as pt from "@blueprintjs/core"
import { IconNames } from "@blueprintjs/icons"

const context = new BindingContext()

const NumberWorkbench = Workbench.ofType<number>()
const StringWorkbench = Workbench.ofType<string>()

function nonEmpty(value: string) {
  return value.trim() ? undefined : "value should not be empty"
}

@observer
class ValidationDisplay extends React.Component<{ context: BindingContext }> {
  render() {
    const level = this.props.context.maxErrorLevel
    switch (level) {
      case BindingErrorLevel.Error:
        return (
          <pt.Callout intent={pt.Intent.DANGER} icon={IconNames.WARNING_SIGN}>
            There are some serious issues.
          </pt.Callout>
        )
      case BindingErrorLevel.Warning:
        return (
          <pt.Callout intent={pt.Intent.WARNING} icon={IconNames.WARNING_SIGN}>
            There are some warnings.
          </pt.Callout>
        )
      default:
        return (
          <pt.Callout intent={pt.Intent.SUCCESS} icon={IconNames.TICK}>
            All is well.
          </pt.Callout>
        )
    }
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
            id="readme"
            children="readme"
            panel={
              <div>
                <h4>Brazen Bindings</h4>
                <p>
                  This is my attempt at a type-safe two-way binding and
                  validation framework for React with mobx.
                </p>
                <p>
                  The tabs on the left let you access the various samples and
                  you may want to check out the{" "}
                  <a href="https://github.com/jtheisen/brazen-bindings/">
                    README on GitHub
                  </a>.
                </p>
              </div>
            }
          />
          <pt.Tab
            id="immediate"
            children="immediate"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.validate(nonEmpty)
                )}
                description={
                  <div>
                    The most simple case of validation. Everything is done
                    immediately.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .validate(nonEmpty)`}
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
                description={
                  <div>
                    A <code>bar()</code> <em>before</em> validation prevents
                    invalid values to be written to the upstream source.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .bar()
  .validate(nonEmpty)`}
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
                description={
                  <div>
                    A <code>defer()</code> <em>after</em> causes validation to
                    happen on focus loss.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .validate(nonEmpty)
  .defer()`}
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
                description={
                  <div>
                    {pt.Intent.WARNING}
                    If we swap the order of the last sample, the validation
                    happens immediately again, but the upstream write is still
                    deferred until focus loss.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .defer()
  .validate(nonEmpty)`}
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
                description={
                  <div>
                    Ususally we dont want to validate the source without any
                    prior user interaction, especially in the common case of
                    validating against empty strings. But in some cases, it is
                    desired.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .validate(nonEmpty)
  .validateInitially()`}
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
                  source.convert(floatConverter)
                )}
                description={
                  <div>
                    Conversion of data types, usually involving parsing, can
                    fail is thus a special validation case. Unlike validation
                    with <code>validate()</code>, a failed conversion can never
                    update the upstream source.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .convert(floatConverter)`}
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
            children="fix"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.fix(s => s.toUpperCase())
                )}
                description={
                  <div>
                    Using a framework like this should not make us lose the
                    ability for quick on-the-fly fixes. Throw in a{" "}
                    <code>defer()</code> to make it happen only on focus loss.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .fix(s => s.toUpperCase())`}
              />
            }
          />
          {/* <pt.Tab
            id="throttle"
            children="throttle"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source => source.throttle(1000))}
                description={
                  <div>
                    Throttling is often used with input fields for incremental
                    searches. Normally it's not done on the binding level, but
                    there is a tiny advantage when doing it here: focus loss
                    updates the source immediately.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .throttle(1000)`}
              />
            }
          /> */}
          {/* <pt.Tab
            id="async"
            children="async"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("", source =>
                  source.validateAsync(notFooAsync)
                )}
                description={
                  <div>
                    The `notFooAsync` validator mimics a server request that
                    realizes after a second that the name <em>foo</em> is
                    already taken.
                  </div>
                }
                code={`ctx.bind(model, "value")
  .validate(notFooAsync)`}
              />
            }
          /> */}
          <pt.Tab
            id="complex"
            children="complex"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("x", source =>
                  source
                    .bar()
                    .validate(nonEmpty)
                    .defer()
                    .validate(s => (s === "x" ? "no x please" : undefined))
                    .validateInitially()
                )}
                description={<div>This is the example from the teaser.</div>}
                code={`ctx.bind(model, "value")
  .bar()
  .validate(nonEmpty)
  .defer()
  .validate(s => s === "x"
    ? "no x please"
    : undefined)
  .validateInitially()`}
              />
            }
          />
          <pt.Tab
            id="overloads"
            children="overloads"
            panel={
              <StringWorkbench
                context={context}
                definition={defineBinding("mustnot1", source =>
                  source
                    .bar()
                    .validate("Must not be mustnot1.", v => v !== "mustnot1")
                    .validate(
                      BindingErrorLevel.Warning,
                      "Should not be shouldnot1.",
                      v => v !== "shouldnot1"
                    )
                    .validate(
                      v =>
                        v === "mustnot2" ? "Must not be mustnot2" : undefined
                    )
                    .validate(
                      BindingErrorLevel.Warning,
                      v =>
                        v === "shouldnot2"
                          ? "Should not be mustnot2"
                          : undefined
                    )
                    .validate(
                      makeValidator(
                        "Must not be mustnot3.",
                        (v: string) => v !== "mustnot3"
                      )
                    )
                    .validate(
                      BindingErrorLevel.Warning,
                      makeValidator(
                        "Should not be shouldnot3.",
                        v => v !== "shouldnot3"
                      )
                    )
                    .validateInitially()
                )}
                description={
                  <div>
                    The binding builder has a number of overloads for
                    convenience.
                  </div>
                }
              />
            }
          />
        </pt.Tabs>
      </div>
    )
  }
}
