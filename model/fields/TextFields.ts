import {
  Field,
  FieldConfig,
  ModelFieldValidateArgs,
} from "./Field";
import { ModelFieldValidationError } from "./ModelFieldValidationError";

type TextFieldConfig = FieldConfig<string> & {
  maxLength?: number;
  minLength?: number;
};
export class TextField extends Field<string> {
  maxLength?: number;
  minLength?: number;
  constructor(config: TextFieldConfig) {
    super(config);

    if (config.maxLength || typeof config.maxLength === 'number' || Number.isFinite(config.maxLength)) {
      this.maxLength = parseInt(config.maxLength as any);

      if (!Number.isFinite(this.maxLength)) {
        throw new Error("maxLength should be a valid number");
      }
    }

    if (config.minLength || typeof config.minLength === 'number' || Number.isFinite(config.minLength)) {
      this.minLength = parseInt(config.minLength as any);

      if (!Number.isFinite(this.minLength)) {
        throw new Error("minLength should be a valid number");
      }
    }
  }

  validate(props: ModelFieldValidateArgs): string | null {
    const value = super.validate(props);

    if (!value) {
      return null;
    }

    if (Number.isFinite(this.maxLength) && value.length > this.maxLength!) {
      
        throw new ModelFieldValidationError(
          `Should contain maximum of ${this.maxLength} characters.`,
          props.name
        );
      
    }

    if (Number.isFinite(this.minLength) && value.length < this.minLength!) {
      
        throw new ModelFieldValidationError(
          `Should contain minimum of ${this.minLength} characters.`,
          props.name
        );
      
    }

    return value;
  }

  parseValue(value: any): string | null {
    value = super.parseValue(value);
    if (value === null || value === undefined) {
      return null;
    }
    return value?.toString();
  }
}
