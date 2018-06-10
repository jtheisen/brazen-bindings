import * as React from "react"
import { BindingContext } from "./context"
import { Binding, IBindingAccessor } from "./bindings"

const globalBindingContext = new BindingContext()

const reactBindingContext = React.createContext<BindingContext>(
  globalBindingContext
)

const BindingContextProvider = reactBindingContext.Provider
export const BindingContextConsumer = reactBindingContext.Consumer

interface BindingContextProviderProps {
  context: BindingContext
  onSeek?: () => any
}

interface InnerBindingContextProviderProps {
  parentContext: BindingContext
  innerContext: BindingContext
}

class InnerBindingContextScope extends React.Component<
  InnerBindingContextProviderProps
> {
  componentDidMount() {
    this.props.innerContext.declareParent(this.props.parentContext)
  }

  componentWillUnmount() {
    this.props.innerContext.undeclareParent(this.props.parentContext)
  }

  componentWillReceiveProps(props: InnerBindingContextProviderProps) {
    this.props.innerContext.undeclareParent(this.props.parentContext)
    props.innerContext.declareParent(props.parentContext)
  }

  render() {
    return (
      <BindingContextProvider
        value={this.props.innerContext}
        children={this.props.children}
      />
    )
  }
}

export class BindingContextScope extends React.Component<
  BindingContextProviderProps
> {
  render() {
    return (
      <BindingContextConsumer
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
  binding: IBindingAccessor<T>
  render: () => JSX.Element | string | false | null
}

class InnerBoundComponent<T> extends React.Component<BoundComponent2Props<T>> {
  componentDidMount() {
    this.props.context.register(this.props.binding)
  }

  componentWillReceiveProps(props: Readonly<BoundComponent2Props<T>>) {
    const binding = props.binding
    if (
      this.props.binding !== binding ||
      this.props.context !== props.context
    ) {
      this.props.context.unregister(this.props.binding)
      props.context.register(binding)
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
  render() {
    return (
      <BindingContextConsumer>
        {context => (
          <InnerBoundComponent
            context={context}
            binding={this.props.binding.getBinding()}
            render={this.props.render}
          />
        )}
      </BindingContextConsumer>
    )
  }
}

type InputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
>

export class BoundInput extends React.Component<
  InputProps & { binding: IBindingAccessor<string> }
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
