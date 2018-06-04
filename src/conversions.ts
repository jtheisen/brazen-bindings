import { BindingValue } from "./bindings"

export abstract class Converter<S, T> {
  abstract convert(value: S): BindingValue<T>
  abstract convertBack(value: T): S
}

export class FloatConverter extends Converter<string, number> {
  convert(value: string) {
    if (!value.trim()) return { value: 0, error: "Not a number." }
    const result = Number(value)
    if (Number.isNaN(result)) {
      return { value: 0, error: "Not a number." }
    } else {
      return { value: result }
    }
  }

  convertBack(value: number) {
    return value.toString()
  }
}

export const floatConverter = new FloatConverter()
