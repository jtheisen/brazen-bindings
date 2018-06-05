# Brazon Bindings

## Teaser

This is a code sandbox (*not* a production-ready library) containing an my attempt at a framework for type-safe two-way binding and validation in React with mobx.

With it, you can write a component `<MyInput />` that can be bound against mobx observerbale models within a render function like this:

```
  <MyInput binding={context.bind(model, "somePropertyOfModel")}>
```

The bindings can be modified in a variety of ways, eg.:

```
  <MyInput binding={context.bind(model, "somePropertyOfModel")
    .bar() // stop propagation of invalid values to the source, and
    .validate(noEmptyStrings)   // validate for required input,
    .defer()                    // but show error only on focus loss,
    .validate(specialValidator) // except for this special validation
    .validateInitially()        // which will also be validated right away.
  }>
```

The bindings are a pipeline consisting of building primitives with very limited responsibility each.

## Rationale

* The binding frameworks I've seen so far are not type safe. While I don't think that type safety should be enforced fantaically everywhere, binding form controls to a business model really should be. The names in your own models are the names that gets renamed and otherwise refactored much more often that names from third-party libraries you use. `JSON.stringify` isn't going to change, `myMispelledProperty` will.
* I sometimes want validation to happen on typing and sometimes on focus loss. I sometimes need my invalid input in the model and sometimes I can't have it there. I sometimes want the original value to be validated also and sometimes I don't.
* I want all of that to be consice and comprehensible with a glance.
* I want all that logic to be correct and it won't be when I have to implement it over and over everytime I need it again. I'm too lazy.

I don't think something like that exists yet, so here is my attempt.

## More details

### Avoiding binding state loss

The bindings contain state. This is necessary as edit values can't always be pushed to the model: Sometimes it's because the model contains a data type that invalid user input can't be converted into and sometimes it would just be undesirable to have invalid values in the model even if they could be stored there.

Since we want to be able to create bindings on the fly within a render function,we need to make sure we don't re-render while we still need to preserve that state.

In order to ensure that, components that create bindings in their render functions must not re-render, ie. they shouldn't be observers and their props shouldn't change.

This is usally quite easy. Although the following render function prints out the edited value it is still not depending on its evaluation so has never to be rendered a second time:

```
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

```
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

(Another related and minor other feature it does is the ability to externally trigger validation of those bindings that are invalid but have neither yet been edited by the user nor had been validated initially with `validateInitially()`).

With contexts, there is a catch though: In the last section I talked about how re-rendering a component can cause the binding to be recreated, resulting in the loss of the binding state. While this is often undesirable, it's also sometimes inevitable:

What if the model property in the sample of the last section itself changes, for instance because it was re-fetched from a server? Then a state loss is acceptable, we *do* want the bindings to be recreated, but *don't* want the old, discarded bindings that are in a potentially invalid state to be counted by their binding context.

To achieve that, the bindings have a notion of being *open*. Only open bindings are counted by the context, and they are held open by a helper component if and only if that component is mounted:

```
  <BindingOpener binding={binding} />
```

That component should be put into a `<MyInput />`'s render function and will then ensure that exactly those bindings are open that should be.

However, that also means that all parts of a form that should be validated together must be actually mounted - something that may not necessarily be the case. In this sample, there's a checkbox that determines if hidden tabs are mounted or not, and you can observe how that determines wheter the validation message on the top counts the samples in all tabs or just the one in the active one.

### Input components

This sample's `<MyInput />` contains the display of a potential validation error message, and obviously that's one of the neat things about it.

However, input components in general can be quite complex. Blueprint, which is the css framework that this sample uses, knows the concept of form groups, input groups and control groups, all potentially relevant for the assembly of a sophisticated input control. And there are many css frameworks.

Unfortunately, as soon as validation error message display is part of the component's responsibility, all that other complexity is dragged into it as well due to how css classes for errors have to be put on various elements.

In practice, not only will there be no input control satisfying everyone, there will not even be one that satisfies only me.

So usually one will write different such controls whenever they are each needed sufficiently often. Frequently though, one will still use `<input />`s directly - but even then you can still use bindings, you just have to reference each more than once.

There is however, one core control that can be reused:



### Things not yet considered

