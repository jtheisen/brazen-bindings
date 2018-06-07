export type ConversionResult<T> = T | Error

export abstract class Converter<S, T> {
  abstract convert(value: S): ConversionResult<T>
  abstract convertBack(value: T): S
}

export class FloatConverter extends Converter<string, number> {
  convert(value: string): ConversionResult<number> {
    if (!value.trim()) return Error("Not a number.")
    const result = Number(value)
    if (Number.isNaN(result)) {
      return Error("Not a number.")
    } else {
      return result
    }
  }

  convertBack(value: number) {
    return value.toString()
  }
}

export const floatConverter = new FloatConverter()
