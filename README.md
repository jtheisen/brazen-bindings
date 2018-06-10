# Brazen Bindings

## Teaser

This is a [code sandbox](https://codesandbox.io/s/github/jtheisen/brazen-bindings) (_not_ a production-ready library) containing my attempt at a framework for type-safe two-way binding and validation in [React](https://reactjs.org/) with [MobX](https://github.com/mobxjs/mobx). For a demo, click on the sandbox link.

With this, you can write a component `<MyInput />` that can be bound against MobX observerbale models within a render function like this:

```tsx
<MyInput binding={bind(model, "somePropertyOfModel")} />
```

The bindings can be composed in a variety of ways, eg.:

```tsx
<MyInput
  binding={
    bind(model, "somePropertyOfModel")
      .bar() // stop propagation of invalid values to the source, and
      .validate(noEmptyStrings) // validate for required input,
      .defer() // but show error only on focus loss,
      .validate(specialValidator) // except for this special validation
      .validateInitially() // which will also be validated right away.
  }
/>
```

The bindings are a pipeline consisting of primitives with very limited responsibility each.

## Rationale

- The binding and validation libraries I've seen so far are not type safe. While I don't think that type safety should be enforced fantaically everywhere, binding form controls to a business model really should be. The names in your own models are the names that get renamed (and otherwise refactored) much more often that names from third-party libraries you use. `JSON.stringify` isn't going to change, `myMispelledProperty` will.
- I sometimes want validation to happen on typing and sometimes on focus loss. I sometimes need my invalid input in the model and sometimes I can't have it there. I sometimes want the original value to be validated also and sometimes I don't.
- I want all of that to be consice and comprehensible at a glance.
- I want all that logic to be correct and it won't be when I have to implement it over and over everytime I need it. I'm too bad when bored.

I don't think something like that exists yet, so here is my attempt.

## More details

### The pipeline

The functions in the sample above are defined on a `BindingBuilder<T>` and they assemble a chain of `Binding<T>`s with the following public interface:

```ts
  push(value: BindingValue<any>): void
  peek(): BindingValue<any>

  onFocus(): void
  onBlur(): void
```

`push(value)` pushes a value upstream to the source, `peek()` retrieves a value downstream from the source. The upstream source is usually a model property, the downstream target is a visible component.

Since we're using MobX's dependency tracking system, `peek()` also implies a potential subscription on change events of the source.

A `BindingValue<T>` doesn't only contain the edited value, but also a potential validation error message. That serves two purposes: For one, it can be used by the component at the target end of the pipeline to display such error messages. But it can also be used near the source end of the pipeline to block further propagation of binding values that are in error: That is what the `bar()` bit does in the sample above. It's implemented like this:

```ts
class BarBinding<T> extends NestedBinding<T> {
  push(value: BindingValue<T>) {
    if (!value.error) {
      super.push(value)
    }
  }
}
```

By having tiny components with such limited responsibility, one gets more flexibility: In order to keep only some validation errors from propagating to the source, one can add some validation bindings before and some after the bar binding - similar to how the sample installs one validation binding before and one after the defer binding.

Despite the flexibility, the binding pipeline definition is comprehensible, short and lives where the component instantiation it is bound is.

It is also type safe: At the target component end of the pipeline, it usually is of the `string` type, but at the source model end it could be something parsed, such as `number`. The pipeline's type can change, for example when `convert(floatConverter)` is called on the builder. Such a conversion binding parses the string from downstream and pushes the parsed number upstream - except when the parsing fails, in which case a validation error will be passed downstream instead.

Validators below such a conversion must operate on `string`s, those above operate on `number`s - and that is properly enforced by the type system.

### Avoiding binding state loss

The bindings can contain state. This is necessary as edit values can't always be pushed to the model: Sometimes it's because the model contains a data type that invalid user input can't be converted into and sometimes it would just be undesirable to have invalid values in the model even if they could be stored there.

Since we want to be able to create bindings on the fly within a render function, we need to make sure we don't re-render while we still need to preserve that state.

In order to ensure that, components that create bindings in their render functions should generally not re-render, ie. they their props shouldn't normally change and if they are observers, their render function shouldn't generally evaluate anything that changes.

This is usally quite easy to achieve. Although the following render function prints out the observable model value it is still not depending on its evaluation and so has never to be rendered a second time:

```tsx
  render() {
    return <div>
      <MyInput binding={bind(this.model, "value")
        ...
      }>
      <Indirection render={() => this.model.value />
    </div>
  }
```

The `Indirection` component has this trivial definition:

```tsx
@observer
class Indirection extends React.Component<{
  render: () => JSX.Element | null | false
}> {
  render() {
    return this.props.render()
  }
}
```

That way, it's only the `Indirection` component that gets re-rendered and a change in the value doesn't cause a binding state loss.

### Input components

This sample's `<MyInput />` contains the display of a potential validation error message, and obviously that's one of the neat things about it.

However, input components in general can be quite complex. [Blueprint](http://blueprintjs.com/), which is the css framework that this sample uses, knows the concept of form groups, input groups and control groups, all potentially relevant for the assembly of a sophisticated input component. And there are many css frameworks.

Unfortunately, as soon as validation error message display below the input field is part of the component's responsibility, all that other complexity is dragged into it as well due to how css classes for errors have to be put on various elements.

In practice, not only will there be no input components satisfying everyone, there will not even be one that satisfies only me.

So usually one will write different such components whenever they are each needed sufficiently often. Frequently though, one will still use `<input />`s directly - but even then you can still use bindings, you just have to reference each more than once.

There is, however, one core component that _can_ be reused, if only to implement the others more neatly:

```tsx
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
```

The `BoundComponent`'s purpose brings us to binding contexts.

### Binding contexts

Besides presenting validation problems to the user, it's usually necessary to prevent actions such as saving the model in the presence of such errors. Since we want to create the bindings on-the-fly in render methods, we don't want to also maintain a collection with all of them in it.

That's where the binding context comes in. The binding context is based on React 16 contexts and collects all bindings that are installed in it, either directly, or more easily by using the `BoundComponent` helper.

(Another related and minor other feature it enables is the ability to externally trigger validation of those bindings that are invalid but have neither yet been edited by the user nor had been validated initially with `validateInitially()` - that is usually done when the user triggers a save of the model; but it is certainly not always necessary).

On mounting, the `BoundComponent` in the `BoundInput` above installs the given binding in the ambient context.

That component can be put into a `<MyInput />`'s render function and will then ensure that exactly those bindings are installed that should be.

However, that also means that all parts of a form that should be validated together must be actually mounted - something that may not necessarily be the case. In this sample, there's a checkbox that determines if hidden tabs are mounted or not, and you can observe how that determines wheter the validation message on the top counts the samples in all tabs or just the one in the active one.

The bindings themselves don't know about the context and can also be used without being installed in them.
