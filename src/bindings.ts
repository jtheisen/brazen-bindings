import { observable, reaction, computed } from "mobx";

type ValidationResult = string | undefined;

interface ConvertionResult<T> {
  error?: ValidationResult;
  value?: T;
}

abstract class Converter<S, T> {
  abstract convert(value: S): ConvertionResult<T>;
  abstract convertBack(value: T): S;
}

export class BindingContext {
  @observable private bindings: IBinding[] = [];

  @computed
  get isValid() {
    return this.bindings.every(b => !b.getError());
  }

  validateAll() {
    for (const binding of this.bindings) {
      binding.validate();
    }
  }

  bind<M, P extends keyof M>(model: M, prop: P): BindingBuilder<M[P]> {
    return new BindingBuilder(new PropertyBinding<M, P>(this, model, prop));
  }

  register(binding: IBinding) {
    const i = this.bindings.indexOf(binding);
    if (i >= 0) throw Error("Binding already in context.");
    this.bindings.push(binding);
  }

  unregister(binding: IBinding) {
    const i = this.bindings.indexOf(binding);
    if (i < 0) throw Error("No such binding in context.");
    this.bindings.splice(i, 1);
  }
}

export abstract class BindingProvider<T> {
  abstract getBinding(): Binding<T>;
}

class FloatConverter extends Converter<string, number> {
  convert(value: string) {
    const result = Number(value);
    if (Number.isNaN(result)) {
      return { error: "Not a number." };
    } else {
      return { value: result };
    }
  }

  convertBack(value: number) {
    return value.toString();
  }
}

export const floatConverter = new FloatConverter();

export interface IBinding {
  validate(): void;

  getError(): string | undefined;
}

export abstract class Binding<T> extends BindingProvider<T> implements IBinding {

  constructor(public context: BindingContext) {
    super();
  }

  abstract push(value: T): void;
  abstract peek(): T;

  open() {
    this.context.register(this);
  }

  close() {
    this.context.unregister(this);
  }

  validate() {}

  getError(): string | undefined {
    return undefined;
  }

  onFocus() {}
  onBlur() {}

  getBinding() {
    return this;
  }
}

class PropertyBinding<M, P extends keyof M> extends Binding<M[P]> {
  constructor(context: BindingContext, private model: M, private prop: P) {
    super(context);
  }

  push(value: M[P]) {
    this.model[this.prop] = value;
  }

  peek() {
    return this.model[this.prop];
  }
}

abstract class GeneralNestedBinding<S, T> extends Binding<T> {
  constructor(context: BindingContext, private nested: Binding<S>) {
    super(context);

    reaction(() => this.nested.peek(), v => this.update(v));
  }

  validate() {
    this.nested.validate();
  }

  nestedPush(value: S) {
    this.nested.push(value);
  }
  nestedPeek() {
    return this.nested.peek();
  }

  getError() {
    return this.nested.getError();
  }

  onFocus() {
    this.nested.onFocus();
  }
  onBlur() {
    this.nested.onBlur();
  }

  protected update(value: S) {}
}

class NestedBinding<T> extends GeneralNestedBinding<T, T> {
  constructor(context: BindingContext, nested: Binding<T>) {
    super(context, nested);
  }

  push(value: T) {
    super.nestedPush(value);
  }
  peek() {
    return super.nestedPeek();
  }
}

class BufferBinding<T> extends NestedBinding<T> {
  @observable buffer?: T;

  // Laziness is critical so that binding construction doesn't subscribe.
  hadInitialPeek = false;

  constructor(
    context: BindingContext,
    nested: Binding<T>,
    private isDeferring: boolean
  ) {
    super(context, nested);
  }

  push(value: T) {
    this.buffer = value;
    if (!this.isDeferring) super.push(value);
  }
  peek() {
    if (!this.hadInitialPeek) {
      this.buffer = super.peek();
      this.hadInitialPeek = true;
    }
    return this.buffer!;
  }
  onBlur() {
    if (this.isDeferring) super.push(this.buffer!);

    super.onBlur();
    this.buffer = super.peek();

    // to notify upstream validators
    super.push(this.buffer);
  }

  protected update(value: T) {
    this.buffer = value;
  }
}

class ValidationBinding<T> extends NestedBinding<T> {
  @observable error: ValidationResult;

  constructor(
    context: BindingContext,
    nested: Binding<T>,
    private validator: (value: T) => ValidationResult
  ) {
    super(context, nested);
  }

  validate() {
    this.error = this.validator(this.peek());
  }

  getError() {
    return this.error || super.getError();
  }

  push(value: T) {
    this.update(value);
    if (!this.error) {
      super.push(value);
    }
  }

  protected update(value: T) {
    this.error = this.validator(value);
  }
}

class ConversionBinding<S, T> extends GeneralNestedBinding<S, T> {

  @observable error: ValidationResult;

  constructor(
    context: BindingContext,
    nested: Binding<S>,
    private converter: Converter<T, S>
  ) {
    super(context, nested);
  }

  push(value: T) {
    const result = this.converter.convert(value);
    this.error = result.error;
    if (!this.error) {
      super.nestedPush(result.value!);
    }
  }

  peek(): T {
    return this.converter.convertBack(super.nestedPeek());
  }

  getError() {
    return this.error || super.getError();
  }

  protected update(value: S) {
    this.error = undefined;
  }
}

class ThrottleBinding<T> extends NestedBinding<T> {

  currentKey = {};

  constructor(
    context: BindingContext,
    nested: Binding<T>,
    private millis: number
  ) {
    super(context, nested);
  }

  push(value: T) {
    const key = (this.currentKey = {});
    setTimeout(() => {
      if (this.currentKey === key) super.push(value);
    },
    this.millis);
  }

  protected update(value: T) {
    this.currentKey = {};
  }
}

export class BindingBuilder<T> extends BindingProvider<T> {
  constructor(private binding: Binding<T>) {
    super();
  }

  getBinding() {
    return this.binding;
  }

  buffer() {
    return new BindingBuilder<T>(
      new BufferBinding(this.binding.context, this.binding, false)
    );
  }

  defer() {
    return new BindingBuilder<T>(
      new BufferBinding(this.binding.context, this.binding, true)
    );
  }

  convert<T2>(converter: Converter<T2, T>) {
    return new BindingBuilder<T2>(
      new ConversionBinding(this.binding.context, this.binding, converter)
    );
  }

  fromNumber() {
    const binding = (this.binding as any) as Binding<number>;
    return new BindingBuilder<string>(
      new ConversionBinding(this.binding.context, binding, new FloatConverter())
    );
  }

  validate(validate: (value: T) => ValidationResult) {
    return new BindingBuilder(
      new ValidationBinding(this.binding.context, this.binding, validate)
    );
  }

  throttle(millis: number) {
    return new BindingBuilder(
      new ThrottleBinding(this.binding.context, this.binding, millis)
    );
  }

  apply<T2>(f: (binding: Binding<T>) => Binding<T2>) {
    return new BindingBuilder(f(this.binding));
  }
}
