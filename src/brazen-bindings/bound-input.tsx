import * as React from "react"
import { BindingProvider } from "./bindings"

export type BoundComponentProps<T, P> = { binding: BindingProvider<T> } & P

export class BoundComponent<T, P> extends React.Component<
  BoundComponentProps<T, P>
> {
  get binding() {
    return this.props.binding.getBinding()
  }

  componentDidMount() {
    this.binding.open()
  }

  componentWillReceiveProps(props: Readonly<BoundComponentProps<T, P>>) {
    const binding = props.binding.getBinding()
    if (this.binding !== binding) {
      this.binding.close()
      binding.open()
    }
  }

  componentWillUnmount() {
    this.binding.close()
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
    const innerBinding = binding.getBinding()
    return (
      <input
        {...rest}
        value={innerBinding.peek().value}
        onChange={e => innerBinding.push({ value: e.currentTarget.value })}
        onFocus={() => innerBinding.onFocus()}
        onBlur={() => innerBinding.onBlur()}
      />
    )
  }
}
