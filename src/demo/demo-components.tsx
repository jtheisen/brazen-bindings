import * as React from "react"
import { observable } from "mobx"
import { observer } from "mobx-react"
import * as classnames from "classnames"
import {
  BindingBuilder,
  BindingContext,
  BindingErrorLevel,
  BoundInput,
  BindingProvider,
  BoundComponent
} from "../brazen-bindings"
import * as pt from "@blueprintjs/core"

@observer
export class Rendering extends React.Component<{
  render: () => JSX.Element | string | null | false
}> {
  render() {
    return this.props.render()
  }
}

interface IBoundInputProps<T> {
  label?: string
  binding: BindingProvider<T>
  reset?: () => void
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

    const binding = this.props.binding.getBinding()
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

export interface IWorkbenchProps<T> {
  context: BindingContext
  definition: IBindingDefinitionWithDefault<T>
  description?: JSX.Element
  code?: string
}

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
          <MyInput
            label="Editor"
            binding={this.makeBinding()}
            reset={() => (this.value = this.props.definition.def)}
          />
          <label className="pt-label pt-disabled">
            Source
            <Rendering
              render={() => (
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
          {this.props.code && (
            <pre>
              <code>{this.props.code}</code>
            </pre>
          )}
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
    const result = this.props.definition.makeBinding(
      this.props.context.bind(this, "loggedValue")
    )
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

type HTMLInputProps = React.InputHTMLAttributes<HTMLInputElement>

class InputGroupWithMessage extends React.Component<
  pt.IInputGroupProps &
    HTMLInputProps & {
      messageIcon?: pt.IconName
      message?: JSX.Element | string
    }
> {
  render() {
    const { message, rightElement, ...props } = this.props
    const newRightElement = props.messageIcon
      ? (([this.renderIconInTooltip(), rightElement] as any) as JSX.Element)
      : rightElement
    return <pt.InputGroup {...props} rightElement={newRightElement} />
  }

  renderIconInTooltip() {
    return this.props.message ? (
      <pt.Tooltip content={this.props.message} intent={this.props.intent}>
        {this.renderIcon()}
      </pt.Tooltip>
    ) : (
      this.renderIcon()
    )
  }

  renderIcon() {
    return (
      <pt.Button className="pt-unbutton">
        <pt.Icon
          iconSize={
            this.props.large ? pt.Icon.SIZE_LARGE : pt.Icon.SIZE_STANDARD
          }
          icon={this.props.messageIcon}
          intent={this.props.intent}
        />
      </pt.Button>
    )
  }
}

@observer
export class BoundInputGroup extends React.Component<
  pt.IInputGroupProps & HTMLInputProps & { binding: BindingProvider<string> }
> {
  render() {
    const { binding, intent, ...rest } = this.props
    const innerBinding = binding.getBinding()
    const poke = innerBinding.peek()
    const message = poke.error && poke.error.message
    const messageIcon = this.getIcon(poke.error && poke.error.level)
    const usedIntent = this.getIntent(poke.error && poke.error.level)
    return (
      <>
        <BoundComponent binding={innerBinding} />
        <InputGroupWithMessage
          {...rest}
          value={innerBinding.peek().value}
          message={message}
          messageIcon={messageIcon}
          intent={usedIntent}
          onChange={(e: any) =>
            innerBinding.push({ value: e.currentTarget.value })
          }
          onBlur={() => innerBinding.onBlur()}
          onFocus={() => innerBinding.onFocus()}
        />
      </>
    )
  }

  getIntent(level?: BindingErrorLevel) {
    switch (level) {
      case BindingErrorLevel.Fatal:
      case BindingErrorLevel.Error:
        return pt.Intent.DANGER
      case BindingErrorLevel.Warning:
        return pt.Intent.WARNING
      default:
        return undefined
    }
  }

  getIcon(level?: BindingErrorLevel) {
    switch (level) {
      case BindingErrorLevel.Fatal:
      case BindingErrorLevel.Error:
      case BindingErrorLevel.Warning:
        return "warning-sign"
      default:
        return undefined
    }
  }
}
