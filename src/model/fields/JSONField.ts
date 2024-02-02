import { MODEL_ACTIONS } from "../utils";
import { Field, FieldConfig, ModelFieldValidateArgs } from "./Field";
import { ModelFieldValidationError } from "./ModelFieldValidationError";

type JSONFieldConfig = FieldConfig<Record<string, any>> & {
  schema?: Record<string, Field>;
};

export class JSONField extends Field<Record<string, any>> {
  schema?: Record<string, Field>;

  constructor(props: JSONFieldConfig) {
    super(props);
    const {schema} = props
    if(schema) {
      if(typeof schema !== 'object') {
        throw new Error('Invalid schema object.')
      }
      Object.keys(schema).forEach(k => {
        if(!(schema[k] instanceof Field)) {
          throw new Error(`Invalid "${k}" in the schema. Every key in schema must be an instance of Field class.`)
        }
      })
    }
    this.schema = schema;
  }

  validate(props: ModelFieldValidateArgs): Record<string, any> | null {
    const value = super.validate(props);

    if (value === null) {
      return null;
    }
    return this.getSchemaValidatedValues(value);
  }

  private getSchemaValidatedValues(value: any) {
    if (!this.schema) {
      return value || null;
    }

    const validatedObject: Record<string, any> = {};
    Object.keys(this.schema).forEach((k) => {
      try {
        validatedObject[k] = this.schema?.[k].validate({
          name: k,
          modelInstance: value,
          value: value[k],
          fieldName: k,
          modelAction: MODEL_ACTIONS.CREATE
        });
      } catch (e: any) {
        if(e instanceof ModelFieldValidationError) {
          throw new Error(`${e.fieldName}: ${e.message}`)
        }
        throw new Error(`${k}: ${e.message}`)
      }
    });
    return validatedObject;
  }

}
