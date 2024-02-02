import {
  ModelDataEmitError,
  ModelFieldError,
  ModelParsingError,
  ModelValidationError,
} from "./ModelErrors";
import { QuerySet } from "./QuerySet";
import { Field } from "./fields/Field";
import { ModelFieldValidationError } from "./fields/ModelFieldValidationError";
import { MODEL_ACTIONS } from "./utils";

export enum MODEL_DATA_SOURCES {
  USER_PROVIDED_UNSAVED,
  NETWORK_SAVED,
  NETWORK_UNSAVED,
}

type GetTypeForField<T extends Field> = ReturnType<T["emitValue"]>;

type ModelObjectValueObject<T extends Record<string, Field>> = {
  [K in keyof T]?: GetTypeForField<T[K]>;
};

// BaseModel Class
export abstract class Model<T extends Record<string, Field> = any> {
  data: Record<string, any> = {};

  private isSaved = false;

  constructor(data: ModelObjectValueObject<T>, isSaved = false) {
    this.data = {} as any;
    if (data) {
      this.set(data);
    }
    this.isSaved = isSaved;

    const fields = this.fields();
    if (!Object.keys(fields).length) {
      throw new Error(`${this.getName()} does not have any fields defined.`);
    }

    if (
      Object.keys(fields).filter((k) => !!fields[k].primaryField).length > 1
    ) {
      throw new Error(
        `${this.getName()} has more than one primary field. The can only be one primary field.`
      );
    }
    Object.keys(fields).forEach((k) => {
      if (!(fields[k] instanceof Field)) {
        throw new ModelFieldError("Should be an instance of a field.", k);
      }
    });
  }

  isValid = false;

  private _fieldsMap: Record<string, { name: string; field: Field }[]> | null =
    null;

  private getFieldsMap(): Record<string, { name: string; field: Field }[]> {
    if (!this._fieldsMap) {
      const fieldsMap: Record<string, { name: string; field: Field }[]> = {};

      const fields = this.fields();

      Object.keys(fields).forEach((fname) => {
        const field = fields[fname];

        const fieldsToWatch = field.watchFields(fname) || [];

        fieldsToWatch
          .filter((f) => !!f)
          .map((f) => f?.toString())
          .forEach((fn) => {
            fieldsMap[fn] = [
              ...(fieldsMap[fn] || []),
              {
                name: fname,
                field,
              },
            ];
          });
      });
      this._fieldsMap = fieldsMap;
    }

    return this._fieldsMap;
  }

  get hasPrimaryField() {
    const [name] = this.getPrimaryField() || [];
    return name ? true : false;
  }

  public static endpoint(): string {
    throw new Error("Endpoint method is not implemented.");
  }

  abstract fields(): T;

  abstract getName(): string;

  getPrimaryField(): [name: string, field: Field] | null {
    const fields = this.fields();
    const k = Object.keys(fields).find((k) => fields[k]?.primaryField);
    return k ? [k, fields?.[k]] : null;
  }

  getPrimaryFieldValue() {
    const [name] = this.getPrimaryField() || [];
    if (!name) {
      return null;
    }

    return this.data[name] === undefined || this.data[name] === null
      ? null
      : this.data[name];
  }

  static get objects() {
    return new QuerySet({ model: this as any });
  }

  private get classObject(): typeof Model {
    return this.constructor as typeof Model;
  }

  emitData() {
    const modelFields = this.fields();

    const action = this.isSaved ? MODEL_ACTIONS.UPDATE : MODEL_ACTIONS.CREATE;

    return this._emitDataForFields(Object.keys(modelFields), action);
  }
  emitDataForFields(modelFields: string[], action: MODEL_ACTIONS) {
    const fieldsMap = this.getFieldsMap();
    for (const fname of modelFields) {
      if (!fieldsMap[fname]) {
        throw new Error(`Field ${fname} does not exist on ${this.getName()}.`);
      }
    }
    return this._emitDataForFields(modelFields, action);
  }

  private _emitDataForFields(modelFields: string[], action: MODEL_ACTIONS) {
    let emittedData: Record<string, any> = {};
    const errors: Record<string, string> = {};

    const fields = this.fields();
    const fieldsMap = this.getFieldsMap()

    modelFields.forEach((k) => {
      const fieldName = fieldsMap[k][0].name
      const field = fields[fieldName];

      try {
        const emittedValue = field.emitValue({
          name: fieldName,
          value: this.data[k],
          modelInstance: this,
          modelAction: action,
        });

        if (
          typeof emittedValue !== "object" ||
          Array.isArray(emittedValue) ||
          emittedValue === null
        ) {
          throw new Error(
            `Could not emit data. ${k}.${field.emitValue.name} returned an invalid object.`
          );
        }

        emittedData = {
          ...emittedData,
          ...(emittedValue || {}),
        };
      } catch (e: any) {
        errors[k] = e?.message || e?.toString();
      }
    });

    if (Object.keys(errors).length > 0) {
      throw new ModelDataEmitError(
        "Failed to emit data from some fields.",
        errors,
        this.classObject
      );
    }
    return emittedData;
  }

  async save() {
    if (this.isSaved) {
      // Object has an ID, update it
      if (!this.hasPrimaryField) {
        throw new Error(
          "Cannot save a model without primary field. Specify a primary field in the config when initiating the fields."
        );
      }

      // Update the object
      const instance: Model =
        (await this.classObject.objects.updateObject(this)) || [];

      // Copy the returned instance data
      this.setData(instance.data);
    } else {
      // Object doesn't have an ID, create it
      const instance: Model = await this.classObject.objects.create(this);

      // Copy the returned instance data
      this.setData(instance.data);
    }

    this.isSaved = true;

    // Returned instance data is already validated
    this.isValid = true;
  }

  async delete() {
    if (!this.hasPrimaryField) {
      // If there is not primary field on the model
      // We shouldn't be able to delete it
      throw new Error(
        "Cannot delete a model without primary field. Specify a primary field in the config when initiating the field."
      );
    }

    if (!this.getPrimaryFieldValue()) {
      // Cannot delete an object that is not saved
      throw new Error("Instance does not have primary field value.");
    }

    await this.classObject.objects.deleteObject(this);
  }

  validate(action?: MODEL_ACTIONS) {
    const modelAction =
      action || (this.isSaved ? MODEL_ACTIONS.UPDATE : MODEL_ACTIONS.CREATE);

    const fields = this.getFieldsMap();

    const errors = this._validateFields(Object.keys(fields), modelAction);
    this.isValid = Object.keys(errors).length === 0;

    if (!this.isValid) {
      throw new ModelValidationError("Model validation failed.", errors);
    }
  }
  validateFields(fieldNames: string[], modelAction: MODEL_ACTIONS) {
    const fieldsMap = this.getFieldsMap();
    for (const fname of fieldNames) {
      if (!fieldsMap[fname]) {
        throw new Error(`Field ${fname} does not exist on ${this.getName()}.`);
      }
    }
    const errors = this._validateFields(fieldNames, modelAction);
    const isValid = Object.keys(errors).length === 0;
    if(!isValid) {
      throw new ModelValidationError('Model validation failed.', errors)
    }
  }

  private _validateFields(fields: string[], modelAction: MODEL_ACTIONS) {
    // Map for keeping errors thrown by fields
    const errors: Record<string, string> = {};

    const fieldsMap = this.getFieldsMap();

    for (const fieldKey of fields) {
      const fieldValue = this.data[fieldKey];
      const fieldsWatching = fieldsMap[fieldKey];
      fieldsWatching.forEach((f) => {
        try {
          const validatedValue = f.field.validate({
            name: f.name,
            fieldName: fieldKey,
            modelAction,
            modelInstance: this,
            value: fieldValue,
          });
          this.data[fieldKey] = validatedValue;
        } catch (e: any) {
          let errorMessage = "";
          if (e instanceof ModelFieldValidationError) {
            errors[e.fieldName] = e.message;
          } else {
            errorMessage = e?.message || e?.toString();
            errors[fieldKey] = errorMessage;
          }
        }
      });
    }
    return errors;
  }

  toString() {
    let res = "";
    if (this.getPrimaryFieldValue()) {
      res = `(${this.getPrimaryFieldValue()?.toString()})`;
    }
    return `${this.getName()} ${res}`;
  }

  set(obj: ModelObjectValueObject<T>) {
    const fieldsMap = this.getFieldsMap();

    // should not be valid if the values are being set
    this.isValid = false;

    let valuesObject: Record<string, any> = {};

    Object.keys(obj).forEach((k) => {
      // eslint-disable-next-line no-prototype-builtins
      if (obj?.hasOwnProperty(k)) {
        if (!fieldsMap[k]) {
          throw new Error(`Field ${k} does not exist on ${this.getName()}`);
        }

        // All the fields listening to this field name
        const fields = fieldsMap[k];

        fields.forEach((f) => {
          const fieldsDataOnObject: Record<string, any> = f.field.setValue({
            modelInstance: this,
            name: f.name,
            value: obj[k],
            fieldName: k,
          });

          if (
            typeof fieldsDataOnObject !== "object" ||
            Array.isArray(fieldsDataOnObject) ||
            fieldsDataOnObject === null
          ) {
            throw new Error(
              `Cannot set value on the model. ${k}.${f.field.setValue.name} returned an invalid object.`
            );
          }

          valuesObject = {
            ...valuesObject,
            ...fieldsDataOnObject,
          };
        });
      }
    });

    this.setData(valuesObject);
  }

  private setData(values: Record<string, any>) {
    this.data = {
      ...this.data,
      ...values,
    };
  }

  static fromIOObject(ioObject: Record<string, any>) {
    // create a new model instance
    const modelInstance: Model = new (this as any)({}, true);

    const fields: Record<string, Field> = modelInstance.fields();

    const errors: Record<string, string> = {};

    Object.keys(fields).forEach((f) => {
      const field = fields[f];
      try {
        const processedFieldObject = field.fromIOObject({
          ioObject,
          name: f,
          modelInstance,
        });

        if (
          typeof processedFieldObject !== "object" ||
          !processedFieldObject ||
          Array.isArray(processedFieldObject)
        ) {
          throw new Error(
            `Cannot initialize the model with IO data. fromIOObject on field returned an invalid object. Field should only emit a spreadable non array object with model values. Something you can pass to Model.set({...}).`
          );
        }

        // set returned data on the model instance
        try {
          modelInstance.set(processedFieldObject);
        } catch (e: any) {
          throw new Error(
            `fromIOObject on field might have returned incorrect field names or there is a bug in the class definition. If this is #Library provided Field class, Please report this so we can fix it asap. Could not set data on the instance. Error: ${
              e?.message || e?.toString()
            }`
          );
        }
      } catch (e: any) {
        errors[f] = e?.message;
      }
    });

    if (Object.keys(errors).length > 0) {
      throw new ModelParsingError(
        "Failed to create model instance from external data.",
        errors
      );
    }

    return modelInstance;
  }
}

// Example field classes (IntegerField, TextField, DateField) should be defined separately

const registry: any = {};

export function FieldN({ primaryField = false }: { primaryField?: boolean }) {
  // Property decorator example
  return function FieldDecorator(target: any, key: string) {
    // You can modify property behavior or add metadata here
    const modelName = getModelName(target);
    if (!modelName) {
      throw new Error("Could not get model name.");
    }

    if (!registry[modelName]) {
      registry[modelName] = {
        modelClass: target,
        fields: {},
      };
    }

    registry[modelName].fields[key] = {
      primaryField,
    };
  };
}

function getModelName(modelClass: any) {
  return modelClass?.name || "";
}

/*
  Model.save () {
    if the primary field value exists {
      validate data
      Queryset.saveInstances([this])
    }
    else {
      validate data
      Queryset.createInstances([this])
    }
  }
*/
