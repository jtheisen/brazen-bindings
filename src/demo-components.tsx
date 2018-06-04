import * as React from "react"
import { observable } from "mobx"
import { observer } from "mobx-react"
import { BoundInput } from "./bound-inputs"
import { BindingBuilder, BindingContext } from "./bindings"

@observer
class Indirection extends React.Component<{
  get: () => JSX.Element | null | false
}> {
  render(): JSX.Element | null | false {
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
      <div>
        <BoundInput
          label="Value 1"
          binding={this.props.context.bind(this, "value1")}
        />
        <BoundInput
          label="Value 2"
          binding={this.props.context
            .bind(this, "value2")
            .validate(
              v =>
                v.length > this.value1.length
                  ? "value 2 must not be longer than value 1"
                  : undefined
            )}
        />
        <Indirection get={() => <div>{this.value2}</div>} />
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
  @observable value: T

  get loggedValue() {
    console.info("accessing value in workbench")
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
    console.info("workbench renders")

    const result = (
      <div className="workbench">
        <div>
          <BoundInput
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

    console.info("workbench finished rendering")

    return result
  }

  makeBinding() {
    const result = this.props.definition
      .makeBinding(this.props.context.bind(this, "loggedValue"))
      .buffer()
    console.info("made binding")
    return result
  }
}

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
