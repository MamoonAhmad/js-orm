import type { Model } from "./Model"

export class ModelValidationError extends Error {
  constructor(error: string, public errorsObject: Record<string, any>) {super(error)}
}


export class ModelParsingError extends Error {
  constructor(message: string, public errors: Record<string, string>) {super(message)}
}

export class ModelFieldError extends Error {
  constructor(m: string, public field: string) {super(m)}
}

export class ModelDataEmitError extends Error{
  constructor(msg :string, public errors: Record<string, any>, public model: typeof Model) {
    super(msg)
  }
  toString() {
    return JSON.stringify(this.errors)
  }
}