import { BindingErrorLevel, IBinding } from "./fundamentals"
import { observable, computed } from "mobx"

export class SeekEvent {
  private handled = false

  get unhandled() {
    return this.handled
  }

  stopPropagation() {
    this.handled = true
  }
}

export interface BindingContextOptions {
  onSeek?: (event: SeekEvent) => any
}

export class BindingContext {
  @observable private parent?: BindingContext
  @observable private children: BindingContext[] = []

  @observable private ownBindings: IBinding[] = []

  constructor(private options?: BindingContextOptions) {}

  @computed
  get allBindings(): { context: BindingContext; binding: IBinding }[] {
    const allChildBindings = this.children
      .map(c => c.allBindings)
      .reduce((aggregate, bindings) => {
        aggregate.push(...bindings)
        return aggregate
      }, [])

    const self: BindingContext = this

    const ownBindings = this.ownBindings.map(b => ({
      context: self,
      binding: b
    }))

    return ownBindings.concat(allChildBindings)
  }

  @computed
  get maxErrorLevel() {
    return this.allBindings
      .map(b => {
        const error = b.binding.peek().error
        return error ? error.level : BindingErrorLevel.None
      })
      .reduce((p, c) => Math.max(p, c), BindingErrorLevel.None)
  }

  get maxErrorLevelBindings() {
    const level = this.maxErrorLevel
    return this.allBindings.filter(b => {
      const error = b.binding.peek().error
      return error && error.level === level
    })
  }

  @computed
  get isValid() {
    return this.maxErrorLevel < BindingErrorLevel.Error
  }

  async validateAll() {
    // This causes all validations to trigger.
    for (const binding of this.ownBindings) {
      binding.push(binding.peek())
      binding.onBlur()
    }

    // isValid would be already correct here
    // unless there's async validation also.
    const promises = this.ownBindings
      .map(v => v.peek().error)
      .map(e => e && e.promise)
    await Promise.all(promises)
  }

  seek() {
    const binding = this.maxErrorLevelBindings[0]

    const nestedContext = binding && binding.context

    const event = new SeekEvent()

    if (nestedContext && nestedContext.maxErrorLevel > BindingErrorLevel.None) {
      return nestedContext.onSeek(event)
    } else {
      return false
    }
  }

  onSeek(event: SeekEvent): void {
    if (this.options && this.options.onSeek) {
      this.options.onSeek(event)
    }

    if (event.unhandled && this.parent) {
      return this.parent.onSeek(event)
    }
  }

  register(binding: IBinding) {
    const i = this.ownBindings.indexOf(binding)
    if (i >= 0) throw Error("Binding already in context.")
    this.ownBindings.push(binding)
  }

  unregister(binding: IBinding) {
    const i = this.ownBindings.indexOf(binding)
    if (i < 0) throw Error("No such binding in context.")
    this.ownBindings.splice(i, 1)
  }

  declareParent(context: BindingContext) {
    if (this.parent) throw Error("Context already has a parent.")
    this.parent = context
    this.parent.children.push(this)
  }

  undeclareParent(context: BindingContext) {
    if (this.parent !== context)
      throw Error("Can't undeclare the wrong parent.")
    const i = this.parent.children.indexOf(this)
    this.parent.children.splice(i, 1)
    this.parent = undefined
  }
}
