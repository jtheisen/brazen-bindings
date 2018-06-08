import {
  BindingError,
  BindingErrorLevel,
  BindingValue,
  IBinding,
  ValidationResult,
  Validator
} from "./fundamentals"
import { observable, reaction, computed } from "mobx"
import { Converter, ConversionResult } from "./conversions"
import { makeValidator } from "./validators"

export interface BindingContextOptions {
  parent?: BindingContext
  onSeek?: () => any
}

export class BindingContext {
  @observable private bindings: IBinding[] = []

  constructor(private options?: BindingContextOptions) {}

  @computed
  get maxErrorLevel() {
    return this.bindings
      .map(b => {
        const error = b.peek().error
        return error ? error.level : BindingErrorLevel.None
      })
      .reduce((p, c) => Math.max(p, c), BindingErrorLevel.None)
  }

  get maxErrorLevelBindings() {
    const level = this.maxErrorLevel
    return this.bindings.filter(b => {
      const error = b.peek().error
      return error && error.level === level
    })
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
      .map(e => e && e.promise)
    await Promise.all(promises)
  }

  seek() {
    const binding = this.maxErrorLevelBindings[0]

    const nestedContext = binding && binding.context

    if (nestedContext && nestedContext.maxErrorLevel > BindingErrorLevel.None) {
      return nestedContext.onSeek()
    } else {
      return false
    }
  }

  onSeek(): boolean {
    if (this.options && this.options.onSeek && this.options.onSeek()) {
      return true
    } else if (this.options && this.options.parent) {
      return this.options.parent.onSeek()
    } else {
      return false
    }
  }

  register(binding: IBinding) {
    binding.context = this
    const i = this.bindings.indexOf(binding)
    if (i >= 0) throw Error("Binding already in context.")
    this.bindings.push(binding)
    if (this.options && this.options.parent) {
      this.options.parent.register(binding)
    }
  }

  unregister(binding: IBinding) {
    if (this.options && this.options.parent) {
      this.options.parent.unregister(binding)
    }
    const i = this.bindings.indexOf(binding)
    if (i < 0) throw Error("No such binding in context.")
    this.bindings.splice(i, 1)
    binding.context = undefined
  }
}

export type BindingProvider<T> =
  | IBindingProvider<T>
  | ((binder: Binder) => BindingBuilder<T>)

export function getBinding<T>(binding: BindingProvider<T>) {
  if (typeof binding === "function") {
    return binding(new Binder()).getBinding()
  } else {
    return binding.getBinding()
  }
}

export interface IBindingProvider<T> {
  getBinding(): Binding<T>
}

export abstract class Binding<T> implements IBindingProvider<T>, IBinding {
  abstract push(value: BindingValue<T>): void
  abstract peek(): BindingValue<T>

  onFocus() {}

  onBlur() {}

  protected validate() {
    this.push(this.peek())
  }

  getBinding() {
    return this
  }
}

class PropertyBinding<M, P extends keyof M> extends Binding<M[P]> {
  constructor(private model: M, private prop: P) {
    super()
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
    super()

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
  private hadInitialPeek = false

  constructor(nested: Binding<T>) {
    super(nested)

    this.buffer = { value: (undefined as any) as T }
  }

  push(value: BindingValue<T>) {
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
    private validator: Validator<T>,
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
    const errorOrNot = this.validator.validate(value.value)
    return errorOrNot
      ? {
          error: { level: this.level, message: errorOrNot },
          value: value.value
        }
      : value
  }
}

// async validation doesn't work properly yet
// class AsyncValidationBinding<T> extends BufferBinding<T> {
//   currentPromise?: Promise<any>

//   constructor(
//     nested: Binding<T>,
//     private validator: (value: T) => Promise<ValidationResult>,
//     private level: BindingErrorLevel = BindingErrorLevel.Error
//   ) {
//     super(nested)
//   }

//   protected update(value: BindingValue<T>) {
//     this.updateAsync(value)
//     const valueWithCaveat = {
//       value: value.value,
//       error: {
//         level: BindingErrorLevel.None,
//         message: "validating...",
//         promise: this.currentPromise
//       }
//     }
//     super.update(valueWithCaveat)
//   }

//   private async updateAsync(value: BindingValue<T>) {
//     const promise = (this.currentPromise = this.validator(value.value))
//     const errorOrNot = await promise
//     if (this.currentPromise === promise) {
//       super.update(
//         errorOrNot
//           ? {
//               error: { level: this.level, message: errorOrNot },
//               value: value.value
//             }
//           : value
//       )
//     }
//   }
// }

class ConversionBinding<S, T> extends GeneralNestedBinding<S, T> {
  @observable private buffer: BindingValue<T>

  // Laziness is critical so that binding construction doesn't subscribe.
  private hadInitialPeek = false

  constructor(nested: Binding<S>, private converter: Converter<T, S>) {
    super(nested)

    this.buffer = { value: (undefined as any) as T }
  }

  push(value: BindingValue<T>) {
    const result = this.converter.convert(value.value)
    const error = value.error || this.getBindingError(result)
    this.buffer = { value: value.value, error: error }
    if (!(result instanceof Error)) super.nestedPush({ value: result })
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

  private getBindingError(
    result: ConversionResult<S>
  ): BindingError | undefined {
    return result instanceof Error
      ? { message: result.message, level: BindingErrorLevel.Error }
      : undefined
  }
}

// class ThrottleBinding<T> extends NestedBinding<T> {
//   pendingValue?: BindingValue<T>

//   constructor(nested: Binding<T>, private millis: number) {
//     super(nested)
//   }

//   push(value: BindingValue<T>) {
//     this.pendingValue = value
//     setTimeout(() => {
//       if (this.pendingValue === value) this.flush()
//     }, this.millis)
//   }

//   onBlur() {
//     this.flush()
//   }

//   flush() {
//     if (this.pendingValue) {
//       super.push(this.pendingValue)
//       this.pendingValue = undefined
//     }
//   }

//   protected update(value: BindingValue<T>) {
//     this.pendingValue = undefined
//   }
// }

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

export class Binder {
  bind<M, P extends keyof M>(model: M, prop: P) {
    return new BindingBuilder(new PropertyBinding(model, prop))
  }
}

export function bind<M, P extends keyof M>(model: M, prop: P) {
  return new BindingBuilder(new PropertyBinding(model, prop))
}

export class BindingBuilder<T> implements IBindingProvider<T> {
  constructor(private binding: Binding<T>) {}

  getBinding() {
    return this.binding
  }

  buffer() {
    return new BindingBuilder(new BufferBinding(this.binding))
  }

  defer() {
    return new BindingBuilder(new DeferringBinding(this.binding))
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

  validate(validator: Validator<T>): BindingBuilder<T>
  validate(message: string, validator: (value: T) => boolean): BindingBuilder<T>
  validate(validator: (value: T) => ValidationResult): BindingBuilder<T>
  validate(level: BindingErrorLevel, validator: Validator<T>): BindingBuilder<T>
  validate(
    level: BindingErrorLevel,
    message: string,
    validator: (value: T) => boolean
  ): BindingBuilder<T>
  validate(
    level: BindingErrorLevel,
    validator: (value: T) => ValidationResult
  ): BindingBuilder<T>
  validate(
    firstArgument:
      | BindingErrorLevel
      | string
      | ((value: T) => ValidationResult)
      | Validator<T>,
    secondArgument?:
      | string
      | ((value: T) => ValidationResult)
      | ((value: T) => boolean)
      | Validator<T>,
    thirdArgument?: (value: T) => boolean
  ) {
    if (typeof firstArgument === "number") {
      if (typeof secondArgument === "string") {
        return new BindingBuilder(
          new ValidationBinding(
            this.binding,
            makeValidator(secondArgument, thirdArgument as (
              value: T
            ) => boolean),
            firstArgument
          )
        )
      } else if (secondArgument instanceof Validator) {
        return new BindingBuilder(
          new ValidationBinding(this.binding, secondArgument, firstArgument)
        )
      } else {
        return new BindingBuilder(
          new ValidationBinding(
            this.binding,
            makeValidator(secondArgument as ((value: T) => ValidationResult)),
            firstArgument
          )
        )
      }
    } else if (typeof firstArgument === "string") {
      return new BindingBuilder(
        new ValidationBinding(
          this.binding,
          makeValidator(firstArgument, secondArgument as (value: T) => boolean)
        )
      )
    } else if (firstArgument instanceof Validator) {
      return new BindingBuilder(
        new ValidationBinding(this.binding, firstArgument)
      )
    } else {
      return new BindingBuilder(
        new ValidationBinding(this.binding, makeValidator(firstArgument))
      )
    }
  }

  // validateAsync(validate: (value: T) => Promise<ValidationResult>) {
  //   return new BindingBuilder(
  //     new AsyncValidationBinding(this.binding, validate)
  //   )
  // }

  // throttle(millis: number) {
  //   return new BindingBuilder(
  //     new ThrottleBinding(this.binding, millis)
  //   ).buffer()
  // }

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
