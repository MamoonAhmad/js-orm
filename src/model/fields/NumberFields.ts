import { Field, FieldConfig, ModelFieldValidateArgs } from "./Field";
import { ModelFieldValidationError } from "./ModelFieldValidationError";

type IntegerFieldConfig = FieldConfig<number> & {
  min?: number;
  max?: number;
};

export class FloatField extends Field<number> {
  min?: number;
  max?: number;

  constructor(props: IntegerFieldConfig) {
    super(props);
    if (props.min !== undefined && !Number.isFinite(props.min)) {
        throw new Error(NUMBER_FIELD_ERRORS.INVALID_MIN)
    }
    if (props.max !== undefined && !Number.isFinite(props.max)) {
      throw new Error(NUMBER_FIELD_ERRORS.INVALID_MAX)
    }
    this.min = props.min;
    this.max = props.max;
  }

  validate(props: ModelFieldValidateArgs): number | null {
    const value = super.validate(props);
    if (value === undefined || value === null) {
      return null;
    }

    this.assertIsFiniteNumber(value);

    if (Number.isFinite(this.min) && value < this.min!) {
      throw new ModelFieldValidationError(
        `Should be greater than ${this.min}.`,
        props.name
      );
    }
    if (Number.isFinite(this.max) && value > this.max!) {
      throw new ModelFieldValidationError(
        `Should be less than ${this.max}.`,
        props.name
      );
    }
    
    return value;
  }

  private assertIsFiniteNumber(value: number) {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Invalid number value. Should be a valid number or parsable number string.`
      );
    }
  }

  parseValue(value: any): number | null {
    value = super.parseValue(value);
    if (value === null || value === undefined) {
      return null;
    }
    
    value = parseFloat(value?.toString() || value);
    return value;
  }
}


export class IntegerField extends FloatField {

  parseValue(value: any): number | null {
    value = super.parseValue(value);
    if (value === null || value === undefined) {
      return null;
    }
    value = parseInt(value?.toString?.() || value);
    return value;
  }
}



export const NUMBER_FIELD_ERRORS = {
  INVALID_MIN: 'Invalid value passed from prop min. Should be a number or not set.',
  INVALID_MAX: "Invalid value passed from prop max. Should be a number or not set."
}