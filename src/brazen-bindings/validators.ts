import { Validator, ValidationResult } from "./fundamentals"

export class ConcreteValidator<T> extends Validator<T> {
  constructor(private validator: (value: T) => ValidationResult) {
    super()
  }

  validate(value: T) {
    return this.validator(value)
  }
}

export abstract class ConstantMessageValidator<T> extends Validator<T> {
  protected abstract message: string

  protected abstract isValid(value: T): boolean

  validate(value: T) {
    return this.isValid(value) ? undefined : this.message
  }
}

export class ConcreteConstantMessageValidator<
  T
> extends ConstantMessageValidator<T> {
  private isValidImpl: (value: T) => boolean

  protected isValid(value: T) {
    return this.isValidImpl(value)
  }

  constructor(protected message: string, isValid: (value: T) => boolean) {
    super()
  }
}

export class NotEmpty extends ConstantMessageValidator<
  string | null | undefined
> {
  message = "Value must not be empty."
  isValid(value: string) {
    return !!value && value.trim() !== ""
  }
}

export function makeValidator<T>(
  validate: (value: T) => ValidationResult
): Validator<T>
export function makeValidator<T>(
  message: string,
  validate: (value: T) => boolean
): Validator<T>
export function makeValidator<T>(
  validatorOrMessage: string | ((value: T) => ValidationResult),
  validatorOrUndefined?: (value: T) => boolean
) {
  if (typeof validatorOrMessage === "string") {
    return new ConcreteConstantMessageValidator(
      validatorOrMessage,
      validatorOrUndefined!
    )
  } else {
    return new ConcreteValidator(validatorOrMessage)
  }
}
