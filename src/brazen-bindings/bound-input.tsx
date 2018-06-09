import * as React from "react"
import {
  Binding,
  BindingContext,
  BindingProvider,
  getBinding,
  IBindingProvider
} from "./bindings"

const globalBindingContext = new BindingContext()

export const reactBindingContext = React.createContext<BindingContext>(
  globalBindingContext
)

interface BindingContextProviderProps {
  context: BindingContext
  onSeek?: () => any
}

interface InnerBindingContextProviderProps {
  parentContext: BindingContext
  innerContext: BindingContext
}

export class InnerBindingContextScope extends React.Component<
  InnerBindingContextProviderProps
> {
  componentDidMount() {
    this.props.innerContext.declareParent(this.props.parentContext)
  }

  componentWillUnmount() {
    this.props.innerContext.undeclareParent(this.props.parentContext)
  }

  render() {
    return (
      <reactBindingContext.Provider
        value={this.props.innerContext}
        children={this.props.children}
      />
    )
  }
}

export class BindingContextScope extends React.Component<
  BindingContextProviderProps
> {
  context: BindingContext

  constructor(props: BindingContextProviderProps) {
    super(props)
    this.context = props.context || new BindingContext()
  }

  render() {
    return (
      <reactBindingContext.Consumer
        children={ctx => (
          <InnerBindingContextScope
            parentContext={ctx}
            innerContext={this.props.context}
            children={this.props.children}
          />
        )}
      />
    )
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
      <reactBindingContext.Consumer>
        {context => (
          <BoundComponent2
            context={context}
            binding={this.binding}
            render={this.props.render}
          />
        )}
      </reactBindingContext.Consumer>
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
