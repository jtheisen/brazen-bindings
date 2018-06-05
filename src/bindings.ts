import { observable, reaction, computed } from "mobx"
import { Converter } from "./conversions"

type ValidationResult = string | undefined

export interface BindingValue<T> {
  value: T
  error?: string
}

export interface IBinding {
  push(value: BindingValue<any>): void
  peek(): BindingValue<any>

  onFocus(): void
  onBlur(): void
}

export class BindingContext {
  @observable private bindings: IBinding[] = []

  @computed
  get isValid() {
    return this.bindings.every(b => !b.peek().error)
  }

  validateAll() {
    for (const binding of this.bindings) {
      binding.push(binding.peek())
      binding.onBlur()
    }
  }

  bind<M, P extends keyof M>(model: M, prop: P): BindingBuilder<M[P]> {
    return new BindingBuilder(new PropertyBinding<M, P>(this, model, prop))
  }

  register(binding: IBinding) {
    const i = this.bindings.indexOf(binding)
    if (i >= 0) throw Error("Binding already in context.")
    this.bindings.push(binding)
  }

  unregister(binding: IBinding) {
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

class BarBinding<T> extends NestedBinding<T> {
  push(value: BindingValue<T>) {
    if (!value.error) {
      super.push(value)
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

class WeakBranchBinding<T> extends NestedBinding<T> {
  constructor(nested: Binding<T>, private weakNested: Binding<T>) {
    super(nested)
  }

  push(value: BindingValue<T>) {
    super.push(value)
    this.weakNested.push(value)
  }

  peek() {
    const value = super.peek()

    return {
      value: value.value,
      error: value.error || this.weakNested.peek().error
    }
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
    this.update(value)
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
    private validator: (value: T) => ValidationResult
  ) {
    super(nested)

    super.update({ value: (undefined as any) as T })
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

  // doesn't yet help us, is should factor our nestedPeek and update
  private getValidated(value: BindingValue<T>) {
    const error = this.validator(value.value)
    return { error: error || value.error, value: value.value }
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
    result.error = value.error || result.error
    this.buffer = { value: value.value, error: result.error }
    super.nestedPush(result)
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
  currentKey = {}

  constructor(nested: Binding<T>, private millis: number) {
    super(nested)
  }

  push(value: BindingValue<T>) {
    const key = (this.currentKey = {})
    setTimeout(() => {
      if (this.currentKey === key) super.push(value)
    }, this.millis)
  }

  protected update(value: BindingValue<T>) {
    this.currentKey = {}
  }
}

// unused, behavior currently present anyhow
class ValidationOnBlurBinding<T> extends NestedBinding<T> {
  onBlur() {
    this.validate()
  }
}

// not sensible this way and currently unused
class ResetOnFocusBinding<T> extends NestedBinding<T> {
  onFocus() {
    this.push(this.peek())
  }
}

class InitialValidationBinding<T> extends BufferBinding<T> {
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

  branchWeakly(
    createNested: (builder: BindingBuilder<T>) => BindingBuilder<T>
  ) {
    const trivial = new TrivialBinding<T>(this.binding.context, {
      value: (undefined as any) as T
    })

    const builder = new BindingBuilder<T>(trivial)

    return new BindingBuilder(
      new WeakBranchBinding(this.binding, createNested(builder).getBinding())
    )
  }

  throttle(millis: number) {
    return new BindingBuilder(new ThrottleBinding(this.binding, millis))
  }

  validateInitially() {
    return new BindingBuilder(new InitialValidationBinding(this.binding))
  }

  validateOnBlur() {
    return new BindingBuilder(new ValidationOnBlurBinding(this.binding))
  }

  resetOnFocus() {
    return new BindingBuilder(new ResetOnFocusBinding(this.binding))
  }

  apply<T2>(f: (binding: Binding<T>) => Binding<T2>) {
    return new BindingBuilder(f(this.binding))
  }
}
