import {
  IBinding,
  BindingValue,
  BindingErrorLevel,
  ValidationResult
} from "./fundamentals"
import { observable, reaction, computed } from "mobx"
import { Converter } from "./conversions"

export class BindingContext {
  @observable private bindings: IBinding[] = []

  constructor(private parent?: BindingContext) {}

  @computed
  get maxErrorLevel() {
    return this.bindings
      .map(b => {
        const error = b.peek().error
        return error ? error.level : BindingErrorLevel.None
      })
      .reduce((p, c) => Math.max(p, c), BindingErrorLevel.None)
  }

  @computed
  get isValid() {
    return this.maxErrorLevel < BindingErrorLevel.Error
  }

  async validateAll() {
    // This causes all validations to trigger.
    for (const binding of this.bindings) {
      binding.push(binding.peek())
      binding.onBlur()
    }

    // isValid would be already correct here
    // unless there's async validation also.
    const promises = this.bindings
      .map(v => v.peek().error)
      .filter(e => e && e.promise)
    //console.info("got " + promises.length + " promises")
    //await Promise.all(promises)
    for (const promise of promises) {
      await promise
    }

    return this.isValid
  }

  bind<M, P extends keyof M>(model: M, prop: P): BindingBuilder<M[P]> {
    return new BindingBuilder(new PropertyBinding<M, P>(this, model, prop))
  }

  trivial<T>(value: BindingValue<T>) {
    return new BindingBuilder(new TrivialBinding(this, value))
  }

  register(binding: IBinding) {
    const i = this.bindings.indexOf(binding)
    if (i >= 0) throw Error("Binding already in context.")
    this.bindings.push(binding)
    if (this.parent) this.parent.register(binding)
  }

  unregister(binding: IBinding) {
    if (this.parent) this.parent.unregister(binding)
    const i = this.bindings.indexOf(binding)
    if (i < 0) throw Error("No such binding in context.")
    this.bindings.splice(i, 1)
  }
}

export abstract class BindingProvider<T> {
  abstract getBinding(): Binding<T>
}

export abstract class Binding<T> extends BindingProvider<T>
  implements IBinding {
  constructor(public context: BindingContext) {
    super()
  }

  abstract push(value: BindingValue<T>): void
  abstract peek(): BindingValue<T>

  onFocus() {}

  onBlur() {}

  open() {
    this.context.register(this)
  }

  close() {
    this.context.unregister(this)
  }

  protected validate() {
    this.push(this.peek())
  }

  getBinding() {
    return this
  }
}

class TrivialBinding<T> extends Binding<T> {
  constructor(context: BindingContext, private value: BindingValue<T>) {
    super(context)
  }

  push() {}

  peek() {
    return this.value
  }
}

class PropertyBinding<M, P extends keyof M> extends Binding<M[P]> {
  constructor(context: BindingContext, private model: M, private prop: P) {
    super(context)
  }

  push(value: BindingValue<M[P]>) {
    this.model[this.prop] = value.value
  }

  peek() {
    return { value: this.model[this.prop] }
  }
}

abstract class GeneralNestedBinding<S, T> extends Binding<T> {
  constructor(private nested: Binding<S>) {
    super(nested.context)

    reaction(() => this.nestedPeek(), v => this.update(v))
  }

  nestedPush(value: BindingValue<S>) {
    this.nested.push(value)
  }
  nestedPeek() {
    return this.nested.peek()
  }

  onFocus() {
    this.nested.onFocus()
  }
  onBlur() {
    this.nested.onBlur()
  }

  protected update(value: BindingValue<S>) {}
}

class NestedBinding<T> extends GeneralNestedBinding<T, T> {
  push(value: BindingValue<T>) {
    super.nestedPush(value)
  }
  peek() {
    return super.nestedPeek()
  }
}

class BufferBinding<T> extends NestedBinding<T> {
  @observable private buffer: BindingValue<T>

  // Laziness is critical so that binding construction doesn't subscribe.
  hadInitialPeek = false

  constructor(nested: Binding<T>) {
    super(nested)

    this.buffer = { value: (undefined as any) as T }
  }

  push(value: BindingValue<T>) {
    //this.update(value)
    super.push(value)
  }

  peek() {
    if (!this.hadInitialPeek) {
      this.hadInitialPeek = true
      this.buffer = super.peek()
    }
    return this.buffer
  }

  protected update(value: BindingValue<T>) {
    this.buffer = value
  }
}

class BarBinding<T> extends BufferBinding<T> {
  push(value: BindingValue<T>) {
    if (!value.error) {
      super.push(value)
    } else {
      super.update(value)
    }
  }
}

class FixBinding<T> extends NestedBinding<T> {
  constructor(nested: Binding<T>, private fix: (value: T) => T) {
    super(nested)
  }

  push(value: BindingValue<T>) {
    super.push({ value: this.fix(value.value), error: value.error })
  }
}

class DeferringBinding<T> extends BufferBinding<T> {
  push(value: BindingValue<T>) {
    this.update(value)
  }

  onFocus() {
    const value = this.peek()
    this.update({ value: value.value })
  }

  onBlur() {
    super.push(this.peek())
  }
}

class ValidationBinding<T> extends BufferBinding<T> {
  constructor(
    nested: Binding<T>,
    private validator: (value: T) => ValidationResult,
    private level: BindingErrorLevel = BindingErrorLevel.Error
  ) {
    super(nested)
    // Super strange: taking this out makes mobx catch an exception
    // in the dependency sample, but in any case the sample works.
    if (!validator) console.info("error!")
  }

  push(value: BindingValue<T>) {
    this.update(value)
    super.push(super.peek())
  }

  nestedPeek() {
    return this.getValidated(super.nestedPeek())
  }

  protected update(value: BindingValue<T>) {
    super.update(this.getValidated(value))
  }

  private getValidated(value: BindingValue<T>): BindingValue<T> {
    const errorOrNot = this.validator(value.value)
    return errorOrNot
      ? {
          error: { level: this.level, message: errorOrNot },
          value: value.value
        }
      : value
  }
}

class AsyncValidationBinding<T> extends BufferBinding<T> {
  currentPromise?: Promise<any>

  constructor(
    nested: Binding<T>,
    private validator: (value: T) => Promise<ValidationResult>,
    private level = BindingErrorLevel.Error
  ) {
    super(nested)
  }

  protected update(value: BindingValue<T>) {
    this.updateAsync(value)
    const valueWithCaveat = {
      value: value.value,
      error: {
        level: BindingErrorLevel.None,
        message: "validating...",
        promise: this.currentPromise
      }
    }
    super.update(valueWithCaveat)
  }

  private async updateAsync(value: BindingValue<T>) {
    const promise = (this.currentPromise = this.validator(value.value))
    const errorOrNot = await promise
    if (this.currentPromise === promise) {
      super.update(
        errorOrNot
          ? {
              error: { level: this.level, message: errorOrNot },
              value: value.value
            }
          : value
      )
    }
  }
}

class ConversionBinding<S, T> extends GeneralNestedBinding<S, T> {
  @observable private buffer: BindingValue<T>

  // Laziness is critical so that binding construction doesn't subscribe.
  hadInitialPeek = false

  constructor(nested: Binding<S>, private converter: Converter<T, S>) {
    super(nested)

    this.buffer = { value: (undefined as any) as T }
  }

  push(value: BindingValue<T>) {
    const result = this.converter.convert(value.value)
    const error = value.error || result.error
    this.buffer = { value: value.value, error: error }
    if (!result.error)
      super.nestedPush({ value: result.value, error: result.error })
  }

  peek() {
    if (!this.hadInitialPeek) {
      this.hadInitialPeek = true
      this.update(super.nestedPeek())
    }
    return this.buffer
  }

  protected update(value: BindingValue<S>) {
    const newValue = this.converter.convertBack(value.value)
    this.buffer = { value: newValue, error: value.error }
  }
}

class ThrottleBinding<T> extends NestedBinding<T> {
  pendingValue?: BindingValue<T>

  constructor(nested: Binding<T>, private millis: number) {
    super(nested)
  }

  push(value: BindingValue<T>) {
    this.pendingValue = value
    setTimeout(() => {
      if (this.pendingValue === value) this.flush()
    }, this.millis)
  }

  onBlur() {
    this.flush()
  }

  flush() {
    if (this.pendingValue) {
      super.push(this.pendingValue)
      this.pendingValue = undefined
    }
  }

  protected update(value: BindingValue<T>) {
    this.pendingValue = undefined
  }
}

class InitialValidationBinding<T> extends NestedBinding<T> {
  private hadOnce = false

  constructor(nested: Binding<T>) {
    super(nested)
  }

  peek() {
    if (!this.hadOnce) {
      this.hadOnce = true
      const source = super.peek()
      this.push(source)
      return source
    } else {
      return super.peek()
    }
  }
}

export class BindingBuilder<T> extends BindingProvider<T> {
  constructor(private binding: Binding<T>) {
    super()
  }

  getBinding() {
    return this.binding
  }

  buffer() {
    return new BindingBuilder<T>(new BufferBinding(this.binding))
  }

  defer() {
    return new BindingBuilder<T>(new DeferringBinding(this.binding))
  }

  convert<T2>(converter: Converter<T2, T>) {
    return new BindingBuilder<T2>(
      new ConversionBinding(this.binding, converter)
    )
  }

  bar() {
    return new BindingBuilder(new BarBinding(this.binding))
  }

  fix(fix: (value: T) => T) {
    return new BindingBuilder(new FixBinding(this.binding, fix))
  }

  validate(validate: (value: T) => ValidationResult) {
    return new BindingBuilder(new ValidationBinding(this.binding, validate))
  }

  validateAsync(validate: (value: T) => Promise<ValidationResult>) {
    return new BindingBuilder(
      new AsyncValidationBinding(this.binding, validate)
    )
  }

  throttle(millis: number) {
    return new BindingBuilder(
      new ThrottleBinding(this.binding, millis)
    ).buffer()
  }

  validateInitially() {
    return new BindingBuilder(
      new InitialValidationBinding(this.binding)
    ).buffer()
  }

  conditionally(
    flag: boolean,
    modifier: (builder: BindingBuilder<T>) => BindingBuilder<T>
  ) {
    if (flag) {
      return modifier(this)
    } else {
      return this
    }
  }

  apply<T2>(f: (binding: Binding<T>) => Binding<T2>) {
    return new BindingBuilder(f(this.binding))
  }
}
