import * as React from "react";
import { observer } from "mobx-react";
import classnames from "classnames";
import { Binding, BindingProvider } from "./bindings";
import * as pt from "@blueprintjs/core";

interface IBoundInputProps<T> {
  label?: string;
  binding: BindingProvider<T>;
  reset?: () => void;
}

type BoundComponentProps<T, P> = { binding: Binding<T> } & P;

class BoundComponent<T, P> extends React.Component<BoundComponentProps<T, P>> {
  componentDidMount() {
    this.props.binding.open();
  }

  componentWillReceiveProps(props: Readonly<BoundComponentProps<T, P>>) {
    if (this.props.binding !== props.binding) {
      this.props.binding.close();
      props.binding.open();
    }
  }

  componentWillUnmount() {
    this.props.binding.close();
  }

  render(): JSX.Element | null | false {
    return null;
  }
}

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>;

export class BoundInput extends BoundComponent<string, InputProps> {
  render() {
    const { binding, ...rest } = this.props;
    return (
      <input
        {...rest}
        value={binding.peek().value}
        onChange={e => binding.push({ value: e.currentTarget.value })}
        onFocus={() => binding.onFocus()}
        onBlur={() => binding.onBlur()}
      />
    );
  }
}

@observer
@pt.HotkeysTarget
export class MyInput extends React.Component<IBoundInputProps<string>> {
  constructor(props: IBoundInputProps<string>) {
    super(props);
  }

  render() {
    console.info("my input renders");

    const binding: Binding<string> = this.props.binding.getBinding();
    const haveError = !!binding.peek().error;
    const result = (
      <div
        className={classnames({
          "pt-form-group": true,
          "pt-intent-danger": haveError
        })}
      >
        {this.props.label && (
          <label className="pt-label">{this.props.label}</label>
        )}
        <div
          className={classnames({
            "pt-input-group": true,
            "pt-intent-danger": haveError
          })}
        >
          <BoundInput className="pt-input" binding={binding} />
          {this.props.reset && (
            <button
              className="pt-button pt-minimal"
              onClick={() => this.props.reset!()}
            >
              reset
            </button>
          )}
        </div>
        <div className="pt-form-helper-text">
          <strong>{binding.peek().error}</strong>
        </div>
      </div>
    );

    console.info("my input finished rendering");

    return result;
  }

  renderHotkeys() {
    return (
      <pt.Hotkeys>
        {this.props.reset && (
          <pt.Hotkey
            label="reset"
            combo="alt + r"
            allowInInput={true}
            onKeyDown={() => this.props.reset!()}
          />
        )}
      </pt.Hotkeys>
    );
  }
}
