


export class ModelFieldValidationError extends Error {
    constructor(msg: string, public fieldName: string) {
        super(msg)
    }
}


export class ModelFieldGeneralError extends Error {
    constructor(msg: string, public fieldName: string) {
        super(msg)
    }
}