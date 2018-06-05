# Brazon Bindings

## Teaser

This is a code sandbox containing an my attempt at a framework for type-safe two-way binding and validation in React with mobx.

With it, you can write a component `<Input />` that can be bound against mobx observerbale models within a render function like this:

```
  <Input binding={context.bind(model, "somePropertyOfModel")}>
```

The bindings can be modified in a variety of ways, eg.:

```
  <Input binding={context.bind(model, "somePropertyOfModel")
    .bar() // stop propagation of invalid values to the source, and
    .validate(noEmptyStrings)   // validate for required input,
    .defer()                    // but only on focus loss,
    .validate(specialValidator) // except this special validation
    .validateInitially()        // which will also be validated right away.
  }>
```

The bindings are a pipeline consisting of building primitives with very limited responsibility.

## Rationale

* type safety
* flexibility
* readability

## More details

### Abstracting an input component or not

The 


### Binding context

Besides presenting validation problems to the user, it's usually necessary to prevent actions such as saving the model in the presence of such errors.

That's the `context` thing in the sample above. 

### Avoiding binding state loss

The bindings contain state. This is necessary as edit values can't always be pushed to the model: Sometimes it's because the model contains a data type that invalid user input can't be converted into and sometimes it would just be undesirable to have invalid values in the model even if they could be stored there.

Since we want to be able to create bindings on the fly within a render function, we need to make sure we don't re-render while we still need to preserve that state.

In order to ensure that, components that create bindings in their render functions must not re-render, ie. they shouldn't be observers and their props shouldn't change.

This is usally quite easy. Although the following render function prints out the edited value it is still not depending on its evaluation so has never to be rendered a second time:

```
  render() {
    return <div>
      <Input binding={context
        .bind(model, "value")
        ...
      }>
      <Indirection render={() => model.value />
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

That way, it's only the `Indirection` component that gets re-rendered.

# Rationale

* type safety
* binding definitions
    * two-way
    * inline
* small building blocks because one size
  fits it all isn't realistic

# Update and validation trigger times

Invalid input should be
* marked as such while focused and reset on blur,
* marked as such while focused and kept on blur,
* marked as such on blur,
* marked as such on blur, but unmarked on focus.

Valid input should update the source
* while focused or
* on blur.

Invalid sources should
* validate also or
* not.

# Other critical

* validation context
* external validation trigger (for validating on save)

# Other

* conversions with validation
* throttling
* async validation
* source change while editing warning

# Testing

Test
* binding recreation
