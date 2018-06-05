# Brazen Bindings

## Teaser

This is a code sandbox (*not* a production-ready library) containing an my attempt at a framework for type-safe two-way binding and validation in React with mobx.

With it, you can write a component `<MyInput />` that can be bound against mobx observerbale models within a render function like this:

```tsx
<MyInput binding={context.bind(model, "somePropertyOfModel")} />
```

The bindings can be modified in a variety of ways, eg.:

```tsx
<MyInput binding={context.bind(model, "somePropertyOfModel")
  .bar() // stop propagation of invalid values to the source, and
  .validate(noEmptyStrings)   // validate for required input,
  .defer()                    // but show error only on focus loss,
  .validate(specialValidator) // except for this special validation
  .validateInitially()        // which will also be validated right away.
}/>
```

The bindings are a pipeline consisting of building primitives with very limited responsibility each.

## Rationale

* The binding frameworks I've seen so far are not type safe. While I don't think that type safety should be enforced fantaically everywhere, binding form controls to a business model really should be. The names in your own models are the names that gets renamed and otherwise refactored much more often that names from third-party libraries you use. `JSON.stringify` isn't going to change, `myMispelledProperty` will.
* I sometimes want validation to happen on typing and sometimes on focus loss. I sometimes need my invalid input in the model and sometimes I can't have it there. I sometimes want the original value to be validated also and sometimes I don't.
* I want all of that to be consice and comprehensible with a glance.
* I want all that logic to be correct and it won't be when I have to implement it over and over everytime I need it again. I'm too lazy.

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

Since we're using mobx's dependency tracking system, `peek()` also implies a potential registration on change events of the source.

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

By having tiny components with such limited responsibility, one gets more flexibility: In order to keep only some validation errors from propagating to the source, one can add some validation bindings before and some after the bar binding - similar to how the sample shows one validation bindings before and one after the defer binding.

Despite the flexibility, the binding pipeline definition is comprehensible, short and lives where the component instantiation it is bound to lives.

It is also type safe: At the target component end of the pipeline, it usually is of the `string` type, but at the source model end it could be something parsed, such as `number`. The pipeline's type can change, for example when `convert(floatConverter)` is called on the builder. Such a conversion binding parses the string form downstream and pushes the parsed number upstream - except when the parsing fails, in which case a validation error will be passed downstream instead.

Validators below such a conversion operate on `string`s, those above operate on `number`s - as it should be.

### Avoiding binding state loss

The bindings can contain state. This is necessary as edit values can't always be pushed to the model: Sometimes it's because the model contains a data type that invalid user input can't be converted into and sometimes it would just be undesirable to have invalid values in the model even if they could be stored there.

Since we want to be able to create bindings on the fly within a render function, we need to make sure we don't re-render while we still need to preserve that state.

In order to ensure that, components that create bindings in their render functions should generally not re-render, ie. they their props shouldn't normally change and if they are observers, their render function shouldn't generally evaluate anything that changes.

This is usally quite easy. Although the following render function prints out the observable model value it is still not depending on its evaluation and so has never to be rendered a second time:

```tsx
  render() {
    return <div>
      <MyInput binding={context
        .bind(this.model, "value")
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

### Binding contexts

Besides presenting validation problems to the user, it's usually necessary to prevent actions such as saving the model in the presence of such errors. 

That's the `context` thing in the sample above: The context knows whether there are any validation errors pending from any binding created from it.

(Another related and minor other feature it enables is the ability to externally trigger validation of those bindings that are invalid but have neither yet been edited by the user nor had been validated initially with `validateInitially()` - that is usually done when the user triggers a save of the model).

With contexts, there is a catch though: In the last section I talked about how re-rendering a component can cause the binding to be recreated, resulting in the loss of the binding state. While this is often undesirable, it's also sometimes inevitable:

What if the model property in the sample of the last section itself changes, for instance because it was re-fetched from a server? Then a state loss is acceptable, we *do* want the bindings to be recreated, but *don't* want the old, discarded bindings that are in a potentially invalid state to be counted by their binding context.

To achieve that, the bindings have a notion of being *open*. Only open bindings are counted by the context, and they are held open by a helper component if and only if that component is mounted:

```tsx
  <BoundComponent binding={binding} />
```

That component can be put into a `<MyInput />`'s render function (or have `MyInput` derive from it) and will then ensure that exactly those bindings are open that should be.

However, that also means that all parts of a form that should be validated together must be actually mounted - something that may not necessarily be the case. In this sample, there's a checkbox that determines if hidden tabs are mounted or not, and you can observe how that determines wheter the validation message on the top counts the samples in all tabs or just the one in the active one.

### Input components

This sample's `<MyInput />` contains the display of a potential validation error message, and obviously that's one of the neat things about it.

However, input components in general can be quite complex. Blueprint, which is the css framework that this sample uses, knows the concept of form groups, input groups and control groups, all potentially relevant for the assembly of a sophisticated input component. And there are many css frameworks.

Unfortunately, as soon as validation error message display is part of the component's responsibility, all that other complexity is dragged into it as well due to how css classes for errors have to be put on various elements.

In practice, not only will there be no input components satisfying everyone, there will not even be one that satisfies only me.

So usually one will write different such components whenever they are each needed sufficiently often. Frequently though, one will still use `<input />`s directly - but even then you can still use bindings, you just have to reference each more than once.

There is however, one core component that *can* be reused, if only to implement the others more neatly:

```tsx
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
```

### Things not yet considered

There are some things that are not difficult to do but not yet part of this sandbox:

* Async validation & awaiting async validation externally is something we surely need,
* binding contexts may require nesting to better support tabbed forms and
* binding contexts may need to have more information from the bindings to allow for some validation errors to prevent some actions and not others.
