import * as React from "react";
import { observer } from "mobx-react";
import * as classnames from "classnames";
import { Binding, BindingProvider } from "./bindings";

interface IBoundInputProps<T> {
  label?: string;
  binding: BindingProvider<T>;
  reset?: () => void;
}

class BindingOpener<T> extends React.Component<{ binding: Binding<T> }> {
  componentDidMount() {
    console.info("opening");
    this.props.binding.open();
  }

  componentWillReceiveProps(props: { binding: Binding<T> }) {
    if (this.props.binding !== props.binding) {
      console.info("switching");
      this.props.binding.close();
      props.binding.open();
    }
  }

  componentWillUnmount() {
    console.info("closing");
    this.props.binding.close();
  }

  render() {
    return null;
  }
}

@observer
export class BoundInput extends React.Component<IBoundInputProps<string>> {
  constructor(props: IBoundInputProps<string>) {
    super(props);
  }

  render() {
    console.info("bound input renders");

    const binding = this.props.binding.getBinding();
    const haveError = !!binding.getError();
    const result = (
      <div
        className={classnames({
          "pt-form-group": true,
          "pt-intent-danger": haveError
        })}
      >
        <BindingOpener binding={binding} />
        {this.props.label && (
          <label className="pt-label">{this.props.label}</label>
        )}
        <div
          className={classnames({
            "pt-input-group": true,
            "pt-intent-danger": haveError
          })}
        >
          <input
            className="pt-input"
            value={binding.peek()}
            onChange={e => binding.push(e.currentTarget.value)}
            onFocus={() => binding.onFocus()}
            onBlur={() => binding.onBlur()}
          />
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
          <strong>{binding.getError()}</strong>
        </div>
      </div>
    );

    console.info("bound input finished rendering");

    return result;
  }
}
