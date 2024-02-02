import { Model } from "../Model";
import {
  Field,
  FieldConfig,
  ModelFieldEmitValueArgs,
  ModelFieldProcessIOObjectArgs,
  ModelFieldSetValueArgs,
  ModelFieldValidateArgs,
} from "./Field";
import { ModelFieldValidationError } from "./ModelFieldValidationError";

type RelatedFieldConfig = Omit<FieldConfig, "primaryField" | "parseValue"> & {
  model: typeof Model<any>;
  field: string;
};

export class RelatedField extends Field {
  model: typeof Model;
  field: string;

  constructor(config: RelatedFieldConfig) {
    super(config);
    // TODO: Potential corrupted data

    if (!config.model) {
      throw new Error("Model is required in the config.");
    }
    if (!config.field) {
      throw new Error("Field name is required in the config.");
    }

    try {
      const modelInstance = new (config.model as any)({});
      if (!(modelInstance instanceof Model)) {
        throw new Error("Class passed should extend the Model class.");
      }
      if (!modelInstance.getPrimaryField()?.[0]) {
        throw new Error(
          `${modelInstance.getName()} does not have a primary field and cannot be used as a related field.`
        );
      }
    } catch (e: any) {
      throw new Error(
        `Invalid model in the config. ${e?.message || e?.toString()}`
      );
    }
    this.model = config.model;

    this.field = config.field;
  }
  /*
    Should return a validated value for the field
  */
  validate(props: ModelFieldValidateArgs) {
    const modelValue = props.modelInstance?.data?.[props?.name] || null;
    const IDValue = props.modelInstance?.data?.[this.field] || null;
    let value = modelValue || IDValue;

    value = super.validate({
      ...props,
      value,
    });

    if (value === null || value === undefined) {
      return null;
    }

    // if only the ID value is set, return the ID
    if (props.fieldName === this.field) {
      if(IDValue === null) {
        return null
      }
      const relatedModelInstance: Model = new (this.model as any)({});
      const [, field] = relatedModelInstance.getPrimaryField()!;
      try {
        field.validate({
          ...props,
          value,
        });
      } catch (e: any) {
        throw new ModelFieldValidationError(
          e?.message || e?.toString(),
          this.field
        );
      }
      return value;
    }

    if(modelValue === null) {
      return null
    }

    if (!(modelValue instanceof this.model)) {
      throw new ModelFieldValidationError(
        `Must be an instance of ${this.model.name}.`,
        props.name
      );
    }
    if (!modelValue.getPrimaryFieldValue()) {
      throw new ModelFieldValidationError(
        `${value.getName()} does not have a primary field value.`,
        props.name
      );
    }
    return modelValue;
  }

  fromIOObject(args: ModelFieldProcessIOObjectArgs): { [x: string]: any } {
    const obj = super.fromIOObject(args);
    if (obj[args.name] instanceof this.model) {
      obj[this.field] = obj[args.name]?.getPrimaryFieldValue?.() || null;
    } else {
      obj[this.field] = obj[args.name];
      obj[args.name] = null;
    }
    return obj;
  }

  watchFields(name: string): string[] {
    return [name, this.field];
  }

  // Watch out - emiValue will be called 
  emitValue(props: ModelFieldEmitValueArgs): Record<string, any> {
    const { modelInstance } = props;
    const modelValue = props.value instanceof this.model ? props.value : null;
    const IDValue = modelInstance.data[this.field];
    const value = modelValue ? modelValue.getPrimaryFieldValue() : IDValue;
    return super.emitValue({ ...props, value });
  }

  setValue(props: ModelFieldSetValueArgs): Record<string, any> {
    const { fieldName, name, value, modelInstance } = props;
    const obj = super.setValue(props);

    const relatedInstance = modelInstance.data[name];
    if (fieldName === this.field) {
      return {
        [name]:
          relatedInstance instanceof this.model &&
          relatedInstance?.getPrimaryFieldValue?.() === value
            ? relatedInstance
            : null,
        [fieldName]: value,
      };
    }

    const instanceValue: Model = obj[name];
    let idValue = null;
    if (instanceValue instanceof this.model) {
      idValue = instanceValue.getPrimaryFieldValue() || null;
    }
    return {
      [this.field]: idValue,
      [fieldName]: instanceValue,
    };
  }
}

/*
  instance.validate() 


*/
