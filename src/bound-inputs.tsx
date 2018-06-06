import * as React from "react"
import { observer } from "mobx-react"
import * as classnames from "classnames"
import { BindingErrorLevel } from "./fundamentals"
import { Binding, BindingProvider } from "./bindings"
import * as pt from "@blueprintjs/core"

interface IBoundInputProps<T> {
  label?: string
  binding: BindingProvider<T>
  reset?: () => void
}

type BoundComponentProps<T, P> = { binding: Binding<T> } & P

class BoundComponent<T, P> extends React.Component<BoundComponentProps<T, P>> {
  componentDidMount() {
    this.props.binding.open()
  }

  componentWillReceiveProps(props: Readonly<BoundComponentProps<T, P>>) {
    if (this.props.binding !== props.binding) {
      this.props.binding.close()
      props.binding.open()
    }
  }

  componentWillUnmount() {
    this.props.binding.close()
  }

  render(): JSX.Element | null | false {
    return null
  }
}

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

export class BoundInput extends BoundComponent<string, InputProps> {
  render() {
    const { binding, ...rest } = this.props
    return (
      <input
        {...rest}
        value={binding.peek().value}
        onChange={e => binding.push({ value: e.currentTarget.value })}
        onFocus={() => binding.onFocus()}
        onBlur={() => binding.onBlur()}
      />
    )
  }
}

@observer
@pt.HotkeysTarget
export class MyInput extends React.Component<IBoundInputProps<string>> {
  constructor(props: IBoundInputProps<string>) {
    super(props)
  }

  getIntent(level: BindingErrorLevel) {
    switch (level) {
      case BindingErrorLevel.None:
        return pt.Intent.NONE
      case BindingErrorLevel.Information:
        return pt.Intent.PRIMARY
      case BindingErrorLevel.Warning:
        return pt.Intent.WARNING
      case BindingErrorLevel.Error:
        return pt.Intent.DANGER
      case BindingErrorLevel.Fatal:
        return pt.Intent.DANGER
      default:
        return pt.Intent.DANGER
    }
  }

  render() {
    console.info("my input renders")

    const binding: Binding<string> = this.props.binding.getBinding()
    const error = binding.peek().error
    const intent = error ? this.getIntent(error.level) : pt.Intent.NONE
    const withPromise = error && error.promise && true
    const inputGroupExtraClass = "pt-intent-" + intent.toLowerCase()
    const result = (
      <pt.FormGroup intent={intent}>
        {this.props.label && (
          <label className="pt-label">{this.props.label}</label>
        )}
        <div className={classnames("pt-input-group", inputGroupExtraClass)}>
          <BoundInput className="pt-input" binding={binding} />
          {withPromise && (
            <span className="pt-input-action">
              <pt.Spinner small={true} />
            </span>
          )}
        </div>
        <div className="pt-form-helper-text">
          <strong>
            <pt.Text ellipsize={true}>{error && error.message}&nbsp;</pt.Text>
          </strong>
        </div>
      </pt.FormGroup>
    )

    console.info("my input finished rendering")

    return result
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
    )
  }
}
