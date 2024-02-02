import { Model } from "./Model";
import {
  DataEmissionError,
  DataOutputError,
  DataValidationError,
  ResponseDataProcessingError,
} from "./TransactionErrors";
import { RelatedField } from "./fields/RelatedField";
import { MODEL_ACTIONS, getIOConnector } from "./utils";

export type QuerySetConfig<T extends Model = never> = {
  model: typeof Model;
  objects?: T[];
  prefetchRelatedFields?: string[];
  filters?: Record<string, any>;
};

export class QuerySet<T extends Model> {
  model: typeof Model;
  prefetchRelatedFields: string[] = [];
  objects: T[] = [];
  filters: Record<string, any>;

  constructor(config: QuerySetConfig<T>) {
    if (!config.model) {
      throw new Error(QUERY_SET_ERRORS.MODEL_REQUIRED());
    }
    this.model = config.model;
    this.objects = config.objects || [];

    if (config.prefetchRelatedFields?.length) {
      this.validateRelatedFieldNames(config.prefetchRelatedFields);
    }
    this.prefetchRelatedFields = config.prefetchRelatedFields || [];
    this.filters = config.filters || {};
  }

  get modelInstance(): Model {
    return new (this.model as any)({});
  }

  private getModelRelatedField(): Record<string, RelatedField> {
    const modelFields = this.modelInstance.fields();
    const relatedFieldNamesInModel = Object.keys(modelFields).filter((k) => {
      return modelFields[k] instanceof RelatedField;
    });
    const relatedField: Record<string, RelatedField> = {};
    relatedFieldNamesInModel.forEach((k) => {
      relatedField[k] = modelFields[k] as RelatedField;
    });
    return relatedField;
  }
  prefetchRelated(relatedFieldNames: string[]) {
    this.validateRelatedFieldNames(relatedFieldNames);

    return this.copyQuerySet({
      prefetchRelatedFields: [
        ...this.prefetchRelatedFields,
        ...relatedFieldNames.filter(
          (fn) => this.prefetchRelatedFields.indexOf(fn) < 0
        ),
      ],
    });
  }
  async getMany(filters?: Record<string, any>) {
    const res = await getIOConnector().list({
      ModelClass: this.model,
      filters,
    });

    // This will throw ResponseDataProcessingError
    const instances = this.processResponseArray(res);

    this.objects = instances as any;
    await this.fetchRelatedFields();
    return instances;
  }

  private processResponseArray(res: any) {
    if (!Array.isArray(res)) {
      throw new ResponseDataProcessingError(
        QUERY_SET_ERRORS.IO_RESPONSE_INVALID_ARRAY(),
        {
          responseObject: res,
        }
      );
    }
    return res.map((r) => this.processResponseObject(r, res));
  }
  private processResponseObject(r: Record<string, any>, responseObject: any) {
    try {
      return this.model.fromIOObject(r);
    } catch (e: any) {
      throw new ResponseDataProcessingError(
        QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
        {
          responseObject,
          error: e,
          errorObject: r,
        }
      );
    }
  }

  async delete() {
    if (!this.modelInstance.getPrimaryField()) {
      throw new DataOutputError(
        QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD(
          this.modelInstance.getName()
        )
      );
    }

    await getIOConnector().delete({
      filters: this.filters,
      ModelClass: this.model,
    });
  }

  async deleteObjects(data: Model[]) {
    if (!this.modelInstance.getPrimaryField()) {
      throw new DataEmissionError(
        QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD(
          this.modelInstance.getName()
        ),
        {}
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(QUERY_SET_ERRORS.SHOULD_BE_ARRAY());
    }

    const assertIsOkToDelete = (instance: Model) => {
      if (!instance.getPrimaryFieldValue()) {
        throw new DataEmissionError(
          QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD_VALUE(
            instance.getName()
          ),
          {
            errorObject: instance,
          }
        );
      }
    };

    const objectsToDelete = data.map((d) => {
      const instance = getModelInstance(d, this.model);
      assertIsOkToDelete(instance);
      return instance;
    });

    await getIOConnector().deleteObjects({
      objectIDs: objectsToDelete.map((m) => m.getPrimaryFieldValue()),
      ModelClass: this.model,
    });
  }

  async deleteObject(data: Model) {
    if (!this.modelInstance.getPrimaryField()) {
      throw new DataOutputError(
        QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD(
          this.modelInstance.getName()
        )
      );
    }

    const instance = getModelInstance(data, this.model);

    if (!instance.getPrimaryFieldValue()) {
      throw new DataOutputError(
        QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD_VALUE(
          instance.getName()
        ),
        {
          errorObject: instance,
        }
      );
    }

    await getIOConnector().deleteObject({
      objectID: instance.getPrimaryFieldValue(),
      ModelClass: this.model,
    });
  }

  async retrieve(id: any) {
    if (!this.modelInstance.getPrimaryField()) {
      throw new Error(
        QUERY_SET_ERRORS.NO_PRIMARY_FIELD(this.modelInstance.getName())
      );
    }
    const res = await getIOConnector().retrieve({
      idValue: id,
      ModelClass: this.model,
    });
    if (typeof res !== "object" || Array.isArray(res)) {
      throw new ResponseDataProcessingError(
        QUERY_SET_ERRORS.IO_RESPONSE_INVALID(),
        {
          responseObject: res,
        }
      );
    }
    let instance: Model;
    try {
      instance = this.model.fromIOObject(res);
    } catch (e: any) {
      throw new ResponseDataProcessingError(
        QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
        {
          responseObject: res,
          error: e,
          errorObject: res,
        }
      );
    }

    this.objects = [instance as any];
    await this.fetchRelatedFields();
    return instance;
  }

  async create(data: Record<string, any> | Model) {
    // throws DataValidationError or DataEmissionError
    const emittedData = this.processInstanceForMutation(
      getModelInstance(data, this.model)
    );

    const res = await getIOConnector().create({
      object: emittedData,
      ModelClass: this.model,
    });

    // throws ResponseDataProcessingError
    const instance = this.processResponseObject(res, res);
    this.objects = [instance as any];
    this.fetchRelatedFields();
    return instance;
  }

  async createObjects(data: Model[]) {
    if (!Array.isArray(data)) {
      throw new Error(QUERY_SET_ERRORS.SHOULD_BE_ARRAY());
    }
    // throws DataValidationError or DataEmissionError
    const emittedData = data?.map((d) =>
      this.processInstanceForMutation(getModelInstance(d, this.model))
    );

    const res = await getIOConnector().createObjects({
      objects: emittedData,
      ModelClass: this.model,
    });

    // throws ResponseDataProcessingError
    const instances = this.processResponseArray(res);
    this.objects = [...(instances as any)];
    this.fetchRelatedFields();
    return instances;
  }

  private processInstanceForMutation(instance: Model<any>) {
    try {
      instance.validate();
    } catch (e: any) {
      throw new DataValidationError(
        QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED(instance.toString()),
        {
          error: e,
          errorObject: instance,
        }
      );
    }

    try {
      return instance.emitData();
    } catch (e: any) {
      throw new DataEmissionError(
        QUERY_SET_ERRORS.MODEL_DATA_EMIT_FAILED(instance.toString()),
        {
          error: e,
          errorObject: instance,
        }
      );
    }
  }

  async update(fieldValues: Record<string, any> = {}) {
    let instance: Model;
    let modelFields: string[] = [];
    const action = MODEL_ACTIONS.UPDATE;
    if (typeof fieldValues !== "object") {
      throw new Error(QUERY_SET_ERRORS.INVALID_MODEL_VALUES_OBJECT());
    }
    try {
      instance = new (this.model as any)(fieldValues);
      modelFields = Object.keys(fieldValues);
    } catch (e: any) {
      throw new Error(
        QUERY_SET_ERRORS.INVALID_UPDATE_OBJECT(e?.message || e?.toString() || e)
      );
    }

    try {
      instance.validateFields(modelFields, action);
    } catch (e: any) {
      throw new DataValidationError(e?.message || e?.toString(), {
        error: e,
        errorObject: fieldValues,
      });
    }

    let emittedData: Record<string, any> = {};
    try {
      emittedData = instance.emitDataForFields(
        Object.keys(fieldValues),
        MODEL_ACTIONS.UPDATE
      );
    } catch (e: any) {
      throw new DataEmissionError(e.message || e?.toString() || e, {
        error: e,
        errorObject: instance,
      });
    }
    await getIOConnector().update({
      modelData: emittedData,
      filters: this.filters,
      ModelClass: this.model,
    });
  }

  async updateObject(data: Model) {
    // throws DataValidationError or DataEmissionError
    const instance = getModelInstance(data, this.model);
    if (!this.modelInstance.getPrimaryField()) {
      throw new Error(
        QUERY_SET_ERRORS.NO_PRIMARY_FIELD(this.modelInstance.getName())
      );
    }
    if (!instance.getPrimaryFieldValue()) {
      throw new Error(QUERY_SET_ERRORS.NO_PRIMARY_FIELD_VALUE());
    }
    const emittedData = this.processInstanceForMutation(instance);

    const res = await getIOConnector().updateObject({
      object: {
        emittedData: emittedData,
        idValue: instance.getPrimaryFieldValue(),
      },
      ModelClass: this.model,
    });

    // throws ResponseDataProcessingError
    const responseInstance = this.processResponseObject(res, res);
    this.objects = [responseInstance as any];
    this.fetchRelatedFields();
    return responseInstance;
  }

  async updateObjects(data: Model[]) {
    if (!Array.isArray(data)) {
      throw new Error(QUERY_SET_ERRORS.SHOULD_BE_ARRAY());
    }
    if (!this.modelInstance.getPrimaryField()) {
      throw new Error(
        QUERY_SET_ERRORS.NO_PRIMARY_FIELD(this.modelInstance.getName())
      );
    }
    const receivedInstances = data.map((d) => {
      const instance = getModelInstance(d, this.model);
      if (!instance.getPrimaryFieldValue()) {
        throw new DataEmissionError(
          QUERY_SET_ERRORS.NO_PRIMARY_FIELD_VALUE_IN_OBJECTS(),
          {
            errorObject: instance,
          }
        );
      }
      return instance;
    });

    // throws DataValidationError or DataEmissionError
    const emittedData = receivedInstances?.map((i) =>
      this.processInstanceForMutation(i)
    );

    const res = await getIOConnector().updateObjects({
      objects: emittedData.map((d, i) => {
        return {
          emittedData: d,
          idValue: receivedInstances[i].getPrimaryFieldValue(),
        };
      }),
      ModelClass: this.model,
    });

    // throws ResponseDataProcessingError
    const instances = this.processResponseArray(res);
    this.objects = [...(instances as any)];
    this.fetchRelatedFields();
    return instances;
  }

  async fetchRelatedFields() {
    if (!this.objects?.length || !this.prefetchRelatedFields.length) {
      return;
    }

    const fieldIds: Record<string, number[]> = {};
    const fieldIdToModelMap: Record<string, Model> = {};
    const relatedFields = this.getModelRelatedField();

    this.prefetchRelatedFields.forEach((fieldName) => {
      const relatedField = relatedFields[fieldName];
      const idField = relatedField.field;
      const ids = this.objects.map((i) => {
        const id = i.data[idField];
        fieldIdToModelMap[`${fieldName}-${id}`] = i;
        return id;
      });
      fieldIds[fieldName] = ids.filter((i) => !!i || Number.isFinite(i));
    });

    const promises: Promise<void>[] = Object.keys(fieldIds).map((fieldName) => {
      const relatedField = relatedFields[fieldName];
      const targetModel: Model = new (relatedField.model as any)();
      const [idFieldName] = targetModel.getPrimaryField() || [];
      if (!idFieldName) {
        // this is very unlikely scenario
      }

      return relatedField.model.objects
        .getMany({ [`${idFieldName}__in`]: fieldIds[fieldName] })
        .then((instances: any[]) => {
          instances.map((r) => {
            const [idFieldName] = r.getPrimaryField() || [];
            const key = `${fieldName}-${r.data[idFieldName]}`;

            const model = fieldIdToModelMap[key];
            if (!model) {
              // This object was not in the filter
              // Probably a misconfiguration on teh backend
              return;
            }
            model.data[fieldName] = r;
          });
        });
    });

    await Promise.all(promises);
  }

  private validateRelatedFieldNames(names: string[]) {
    const instance: Model = new (this.model as any)({});
    const fields = instance.fields();
    names.forEach((f) => {
      if (!fields[f]) {
        throw new Error(
          QUERY_SET_ERRORS.FIELD_DOES_NOT_EXIST_ON_MODEL(f, instance.getName())
        );
      }
      if (!(fields[f] instanceof RelatedField)) {
        throw new Error(QUERY_SET_ERRORS.NOT_A_RELATED_FIELD(f));
      }
    });
  }

  copyQuerySet(config: Partial<QuerySetConfig>) {
    return new QuerySet({
      model: this.model,
      filters: this.filters,
      objects: this.objects,
      prefetchRelatedFields: this.prefetchRelatedFields,
      ...config,
    });
  }
}

export const QUERY_SET_ERRORS = {
  FIELD_DOES_NOT_EXIST_ON_MODEL: (fieldName: string, modelName: string) =>
    `Field ${fieldName} does not exist on the ${modelName}.`,
  NOT_A_RELATED_FIELD: (f: string) =>
    `Field ${f} is not a RelatedField and cannot be pre-fetched.`,
  NO_PRIMARY_FIELD_VALUE_IN_OBJECTS: () =>
    `Failed to emit data. One of the objects has no primary field value.`,
  NO_PRIMARY_FIELD: (modelName: string) =>
    `${modelName} has no primary field specified.`,
  SHOULD_BE_ARRAY: () =>
    `Received invalid object in the params. Should be an array of model instances.`,
  NO_PRIMARY_FIELD_VALUE: () => `Missing primary field value.`,
  INVALID_UPDATE_OBJECT: (errorMessage: string) =>
    `Received invalid update object. Should be a partial model object. ${errorMessage}`,
  INVALID_MODEL_VALUES_OBJECT: () => `Received an invalid model object.`,
  MODEL_DATA_EMIT_FAILED: (modelString: string) =>
    `Failed to emit data from model ${modelString}.`,
  MODEL_VALIDATION_FAILED: (modelString: string) =>
    `Failed to validate model ${modelString}.`,
  IO_RESPONSE_FAILED_TO_INITIALIZE: () =>
    `Failed to create model instance from an object return in response from the IO Connector.`,
  IO_RESPONSE_INVALID: () =>
    `Received an invalid response from the IO Connector.`,
  IO_RESPONSE_INVALID_ARRAY: () =>
    `Received an invalid response from the IO Connector. Expecting an array of objects.`,
  CANNOT_DELETE_NO_PRIMARY_FIELD: (modelName: string) =>
    `Cannot delete the instance of ${modelName} because it does not have a primary field.`,
  CANNOT_DELETE_NO_PRIMARY_FIELD_VALUE: (modelName: string) =>
    `Cannot delete the instance of ${modelName} because it does not have a primary field value.`,
  MODEL_REQUIRED: () => 'Model is required for QuerySet to instantiate.',
};

const getModelInstance = (
  data: Record<string, any> | Model,
  modelType: typeof Model
) => {
  if (data instanceof Model) {
    return data;
  } else {
    const instance: Model = new (modelType as any)({ ...data });
    return instance;
  }
};

/*
  queryset = Customer.objects().filter({id__in: [12,12,12]})
  queryset.fetch()
  queryset.fetchRelated()
  // now query set has objects

  Customer.objects([ins1, ins2]).prefetchRelated('some_other')
  Customer.objects([ins1, ins2]).update()
  Customer.objects([ins1, ins2]).create()


*/
