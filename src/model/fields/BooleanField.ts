import { Field } from "./Field";

export class BooleanField extends Field {
    parseValue(value: any) {
        value = super.parseValue(value);
    if(value === null || value === undefined) {
        return null
    }
    return Boolean(value);
  }
}
