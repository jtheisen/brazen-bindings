export type MessageType = JSX.Element | string

export type ValidationResult = MessageType | undefined

export interface BindingError {
  message: MessageType
  level: BindingErrorLevel
  promise?: Promise<any>
}

export interface BindingValue<T> {
  value: T
  error?: BindingError
}

export enum BindingErrorLevel {
  None, // for async pending information
  Information, // for beneign information
  Warning, // acceptable validation issue
  Error, // unacceptable validation issue
  Fatal // if async operations failed
}

export abstract class Validator<T> {
  abstract validate(value: T): ValidationResult
}

export abstract class AsyncValidator<T> {
  abstract validate(value: T): Promise<ValidationResult>
}

export interface IBinding {
  push(value: BindingValue<any>): void
  peek(): BindingValue<any>

  onFocus(): void
  onBlur(): void
}
