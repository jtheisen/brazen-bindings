import * as React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { BoundInput } from "./bound-inputs";
import { BindingBuilder, BindingContext } from "./bindings";

interface IWorkbenchProps<T> {
  context: BindingContext;
  title: string;
  definition: IBindingDefinitionWithDefault<T>;
}

@observer
class Indirection extends React.Component<{
  get: () => JSX.Element | null | false;
}> {
  render(): JSX.Element | null | false {
    return this.props.get();
  }
}

@observer
export class Workbench<T> extends React.Component<IWorkbenchProps<T>> {
  @observable value: T;

  get loggedValue() {
    console.info("accessing value in workbench");
    return this.value;
  }
  set loggedValue(value: T) {
    this.value = value;
  }

  static ofType<T2>(): { new (): Workbench<T2> } {
    return (Workbench as any) as { new (): Workbench<T2> };
  }

  constructor(props: IWorkbenchProps<T>) {
    super(props);
    this.value = props.definition.def;
  }

  render() {
    console.info("workbench renders");

    const result = (
      <div>
        <h2 style={{ textAlign: "right" }}>{this.props.title}</h2>
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
    );

    console.info("workbench finished rendering");

    return result;
  }

  makeBinding() {
    const result = this.props.definition
      .makeBinding(this.props.context.bind(this, "loggedValue"))
      .buffer();
    console.info("made binding");
    return result;
  }
}

interface IBindingDefinitionWithDefault<T> {
  def: T;
  makeBinding(source: BindingBuilder<T>): BindingBuilder<string>;
}

export function defineBinding<T>(
  def: T,
  makeBinding: (source: BindingBuilder<T>) => BindingBuilder<string>
) {
  return { def, makeBinding };
}
