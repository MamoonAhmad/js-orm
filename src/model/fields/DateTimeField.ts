import { Field, FieldConfig, ModelFieldValidateArgs } from "./Field";
import { ModelFieldValidationError } from "./ModelFieldValidationError";
import { isDateValid } from "./utils";

export type DateTimeFieldConfig = FieldConfig<Date> & {
  min?: Date;
  max?: Date;
};

export class DateTimeField extends Field<Date> {
  min?: Date;
  max?: Date;

  constructor(config: DateTimeFieldConfig) {
    super(config);
    if(config.min !== undefined && config.min !== null) {
      if(!this.isDateValid(config.min)) {
        throw new Error('min: Invalid date object passed.')
      }
      this.min = config.min
    }

    if(config.max !== undefined && config.max !== null) {
      if(!this.isDateValid(config.max)) {
        throw new Error('max: Invalid date object passed.')
      }
      this.max = config.max
    }

    if(this.min && this.max && this.min > this.max) {
      throw new Error('min: Min date should not be after max date.')
    }

  }


  validate(props: ModelFieldValidateArgs): Date | null {
    const value = super.validate(props);

    if(!value) {
      return null
    }

    if(!isDateValid(value)) {
      throw new ModelFieldValidationError('Invalid date.', props.name)
    }
    if (this.max && value > this.max) {
        throw new ModelFieldValidationError(`Date should be before or equal to ${this.max.toString()}`, props.name)
    }
    if (this.min && value < this.min) {
        throw new ModelFieldValidationError(`Date should be after or equal to ${this.min.toString()}`, props.name)
    }
    return value
  }

  parseValue(value: any) {
    value = super.parseValue(value);
    if(value === null || value === undefined) {
        return null 
    }
    return new Date(value)
  }

  private isDateValid(date: any) {
    
    if(!(date instanceof Date)) {
      date = new Date(date)
    }
    return isDateValid(date)
  }
}
