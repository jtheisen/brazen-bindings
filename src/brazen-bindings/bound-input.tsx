import * as React from "react"
import {
  Binding,
  BindingContext,
  BindingProvider,
  getBinding,
  IBindingProvider
} from "./bindings"

const globalBindingContext = new BindingContext()

const { Provider, Consumer } = React.createContext<BindingContext>(
  globalBindingContext
)

export class BindingContextProvider extends React.Component {
  context = new BindingContext()

  render() {
    return <Provider value={this.context}>{this.props.children}</Provider>
  }
}

export type BoundComponent2Props<T> = {
  context: BindingContext
  binding: Binding<T>
  render: () => JSX.Element | string | false | null
}

export type BoundComponentProps<T> = {
  context?: BindingContext
  binding: BindingProvider<T>
  render: () => JSX.Element | string | false | null
}

export class BoundComponent2<T> extends React.Component<
  BoundComponent2Props<T>
> {
  componentDidMount() {
    this.props.context.register(this.props.binding)
  }

  componentWillReceiveProps(props: Readonly<BoundComponent2Props<T>>) {
    const binding = props.binding
    if (this.props.binding !== binding) {
      this.props.context.unregister(this.props.binding)
      this.props.context.register(binding)
    }
  }

  componentWillUnmount() {
    this.props.context.unregister(this.props.binding)
  }

  render(): JSX.Element | string | null | false {
    return this.props.render()
  }
}

export class BoundComponent<T> extends React.Component<BoundComponentProps<T>> {
  binding: Binding<T>

  constructor(props: BoundComponentProps<T>) {
    super(props)
    this.binding = getBinding(props.binding)
  }

  render() {
    return (
      <Consumer>
        {context => (
          <BoundComponent2
            context={context}
            binding={this.binding}
            render={this.props.render}
          />
        )}
      </Consumer>
    )
  }
}

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

export class BoundInput extends React.Component<
  InputProps & { binding: IBindingProvider<string> }
> {
  render() {
    const { binding, ...rest } = this.props
    const innerBinding = binding.getBinding()
    return (
      <BoundComponent
        binding={binding}
        render={() => (
          <input
            {...rest}
            value={innerBinding.peek().value}
            onChange={e => innerBinding.push({ value: e.currentTarget.value })}
            onFocus={() => innerBinding.onFocus()}
            onBlur={() => innerBinding.onBlur()}
          />
        )}
      />
    )
  }
}
