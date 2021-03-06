import * as React from "react"
import { decorate, observable } from "mobx"
import { observer } from "mobx-react"
import { MyInput } from "./bound-inputs"
import { BindingBuilder, BindingContext } from "./bindings"

@observer
class Indirection extends React.Component<{
  get: () => JSX.Element | null | false
}> {
  render() {
    return this.props.get()
  }
}

export class DependencyDemo extends React.Component<{
  context: BindingContext
}> {
  @observable value1 = ""
  @observable value2 = ""

  render() {
    return (
      <div className="workbench">
        <div>
          <MyInput
            label="Value 1"
            binding={this.props.context.bind(this, "value1")}
          />
          <MyInput
            label="Value 2"
            binding={this.props.context
              .bind(this, "value2")
              .validate(v =>
                v.length > this.value1.length
                  ? "value 2 must not be longer than value 1"
                  : undefined
              )}
          />
          <Indirection get={() => <div>{this.value2}</div>} />
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

export interface IWorkbenchProps<T> {
  context: BindingContext
  definition: IBindingDefinitionWithDefault<T>
  description?: JSX.Element
  code?: string
}

@observer
export class Workbench<T> extends React.Component<IWorkbenchProps<T>> {
  value: T

  get loggedValue() {
    return this.value
  }
  set loggedValue(value: T) {
    this.value = value
  }

  static ofType<T2>(): { new (): Workbench<T2> } {
    return (Workbench as any) as { new (): Workbench<T2> }
  }

  constructor(props: IWorkbenchProps<T>) {
    super(props)
    this.value = props.definition.def
  }

  render() {
    const result = (
      <div className="workbench">
        <div>
          <MyInput
            label="Editor"
            binding={this.makeBinding()}
            reset={() => (this.value = this.props.definition.def)}
          />
          <label className="pt-label pt-disabled">
            Source
            <Indirection
              get={() => (
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
        <div>
          <pre>
            <code>{this.props.code}</code>
          </pre>
        </div>
        <div>
          <blockquote>{this.props.description}</blockquote>
        </div>
      </div>
    )

    return result
  }

  makeBinding() {
    const result = this.props.definition.makeBinding(
      this.props.context.bind(this, "loggedValue")
    )
    return result
  }
}
decorate(Workbench, {
  value: observable
})

interface IBindingDefinitionWithDefault<T> {
  def: T
  makeBinding(source: BindingBuilder<T>): BindingBuilder<string>
}

export function defineBinding<T>(
  def: T,
  makeBinding: (source: BindingBuilder<T>) => BindingBuilder<string>
) {
  return { def, makeBinding }
}
