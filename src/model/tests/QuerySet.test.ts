import { Model } from "../Model";
import { QUERY_SET_ERRORS, QuerySet } from "../QuerySet";
import { RelatedField } from "../fields/RelatedField";
import { IntegerField } from "../fields/NumberFields";
import { getIOConnector } from "../utils";
import {
  DataEmissionError,
  DataOutputError,
  DataValidationError,
  ResponseDataProcessingError,
} from "../TransactionErrors";
import {
  ModelDataEmitError,
  ModelParsingError,
  ModelValidationError,
} from "../ModelErrors";
import { Field } from "../fields/Field";

jest.mock("../utils.ts", () => {
  const actual = jest.requireActual("../utils.ts");
  return {
    ...actual,
    getIOConnector: jest.fn(),
  };
});

class MockedRelatedModel extends Model {
  getName(): string {
    return "MockedRelatedModel";
  }
  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
    };
  }
  static endpoint() {
    return "MockedRelatedModel";
  }
}
class MockedRelatedModel1 extends Model {
  getName(): string {
    return "MockedRelatedModel1";
  }
  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
    };
  }
  static endpoint() {
    return "MockedRelatedModel1";
  }
}
class MockedModel extends Model {
  getName(): string {
    return "MockedModel";
  }

  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
      rel: new RelatedField({
        model: MockedRelatedModel,
        field: "rel1_id",
        ioName: "ahem",
      }),
      rel2: new RelatedField({
        model: MockedRelatedModel1,
        field: "rel2_id",
      }),
    };
  }
}

class MockedModelNoPK extends Model {
  getName(): string {
    return "MockedModelNoPK";
  }
  fields() {
    return {
      some: new IntegerField({}),
    };
  }
}

class FieldFailsEmission extends Field {
  emitValue(): Record<string, any> {
    throw new Error("Something went wrong here.");
  }
}

class ModelFailsEmission extends Model {
  getName(): string {
    return "ModelFailsEmission";
  }
  fields() {
    return {
      id: new IntegerField({}),
      some: new FieldFailsEmission({}),
    };
  }
}

class FieldFailsValidation extends Field {
  validate() {
    throw new Error("Something is up.");
  }
}
class ModelFailsValidation extends Model {
  getName(): string {
    return "ModelFailsEmission";
  }
  fields() {
    return {
      id: new IntegerField({}),
      some: new FieldFailsValidation({}),
    };
  }
}

describe("QuerySet", () => {
  describe("constructor", () => {
    it("Should set the config correctly", () => {
      expect(new QuerySet({ model: MockedModel as any }).model).toBe(
        MockedModel
      );
      expect(
        new QuerySet({
          model: MockedModel as any,
          objects: [new MockedModel({})],
        }).objects
      ).toStrictEqual([new MockedModel({})]);
      expect(
        new QuerySet({
          model: MockedModel as any,
          prefetchRelatedFields: ["rel"],
        }).prefetchRelatedFields
      ).toStrictEqual(["rel"]);

      expect(
        new QuerySet({
          model: MockedModel as any,
          filters: { some: 1 },
        }).filters
      ).toStrictEqual({ some: 1 });
    });

    it("Should throw an error if prefetchRelatedFields contains a field that is not a related field", () => {
      expect(
        () =>
          new QuerySet({
            model: MockedModel as any,
            prefetchRelatedFields: ["id"],
          }).prefetchRelatedFields
      ).toThrow(QUERY_SET_ERRORS.NOT_A_RELATED_FIELD("id"));

      expect(
        () =>
          new QuerySet({
            model: MockedModel as any,
            prefetchRelatedFields: ["something"],
          }).prefetchRelatedFields
      ).toThrow(
        QUERY_SET_ERRORS.FIELD_DOES_NOT_EXIST_ON_MODEL(
          "something",
          "MockedModel"
        )
      );
    });
  });

  describe("#modelInstance", () => {});

  describe("prefetchRelated", () => {
    it("Should validate the field names (Should only accept related field names)", () => {
      expect(
        new QuerySet({ model: MockedModel as any }).prefetchRelated(["rel"])
      ).toStrictEqual(
        new QuerySet({
          model: MockedModel as any,
          prefetchRelatedFields: ["rel"],
        })
      );

      expect(() =>
        new QuerySet({ model: MockedModel as any }).prefetchRelated(["rel1"])
      ).toThrow(
        QUERY_SET_ERRORS.FIELD_DOES_NOT_EXIST_ON_MODEL("rel1", "MockedModel")
      );
      expect(() =>
        new QuerySet({ model: MockedModel as any }).prefetchRelated(["id"])
      ).toThrow(QUERY_SET_ERRORS.NOT_A_RELATED_FIELD("id"));
    });

    it("Should return a new QuerySet instance with updated prefetchRelatedFields for chaining", () => {
      expect(
        new QuerySet({ model: MockedModel as any }).prefetchRelated(["rel"])
      ).toStrictEqual(
        new QuerySet({
          model: MockedModel as any,
          prefetchRelatedFields: ["rel"],
        })
      );
      expect(
        new QuerySet({ model: MockedModel as any }).prefetchRelated([
          "rel",
          "rel2",
        ])
      ).toStrictEqual(
        new QuerySet({
          model: MockedModel as any,
          prefetchRelatedFields: ["rel", "rel2"],
        })
      );
      expect(
        new QuerySet({ model: MockedModel as any })
          .prefetchRelated(["rel"])
          .prefetchRelated(["rel2"])
      ).toStrictEqual(
        new QuerySet({
          model: MockedModel as any,
          prefetchRelatedFields: ["rel", "rel2"],
        })
      );
    });
  });

  describe("getMany", () => {
    const listMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          list: listMock,
        };
      });
    });

    afterEach(() => {
      listMock.mockClear();
    });

    it("Should call the connectors list method.", async () => {
      listMock.mockReturnValue(Promise.resolve([]));
      await new QuerySet({ model: MockedModel as any }).getMany({ id: 2 });

      expect(listMock).toHaveBeenCalledTimes(1);
      expect(listMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: { id: 2 },
      });
    });

    it("Error out if the response is not valid", async () => {
      listMock.mockReturnValue(Promise.resolve(1));
      try {
        await new QuerySet({ model: MockedModel as any }).getMany({ id: 2 });
      } catch (e: any) {
        expect(e).toStrictEqual(
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_INVALID_ARRAY()
          )
        );
        expect(e.metaData).toStrictEqual({
          responseObject: 1,
        });
      }
    });

    it("Should output appropriate information about the object in the response if it fails to initialize", async () => {
      const invalidObject = {
        ahem: 1,
        rel2: 2,
      };
      listMock.mockReturnValue(Promise.resolve([invalidObject]));
      try {
        await new QuerySet({ model: MockedModel as any }).getMany({ id: 2 });
      } catch (e: any) {
        expect(e).toStrictEqual(
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE()
          )
        );
        expect(e.metaData).toStrictEqual({
          responseObject: [invalidObject],
          errorObject: invalidObject,
          error: new ModelParsingError(
            "Failed to create model instance from external data.",
            {}
          ),
        });
        expect(e.metaData.error.errors).toStrictEqual({
          id: "Received a null value for non-nullable field.",
        });
      }
    });

    it("Should prefetch the related fields.", async () => {
      listMock.mockReturnValue(Promise.resolve([]));
      const querySet = new QuerySet({ model: MockedModel as any });
      const prefetchFunction = jest.spyOn(
        querySet,
        "fetchRelatedFields" as any
      );
      await querySet.getMany({ id: 2 });

      expect(listMock).toHaveBeenCalledTimes(1);
      expect(listMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: { id: 2 },
      });
      expect(prefetchFunction).toHaveBeenCalledTimes(1);
      expect(prefetchFunction).toHaveBeenCalledWith();
    });

    it("Should set objects in the query set when fetched", async () => {
      listMock.mockReturnValue(
        Promise.resolve([
          { id: 1, ahem: 1, rel2: 2 },
          { id: 2, ahem: 3, rel2: 4 },
        ])
      );

      const querySet = new QuerySet({ model: MockedModel as any });
      const res = await querySet.getMany();
      expect(querySet.objects).toStrictEqual(res);
      expect(querySet.objects).toStrictEqual([
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 2 }, true),
        new MockedModel({ id: 2, rel1_id: 3, rel2_id: 4 }, true),
      ]);
    });

    it("Should return instances of Model initiated with", async () => {
      listMock.mockReturnValue(
        Promise.resolve([
          { id: 1, ahem: 1, rel2: 2 },
          { id: 2, ahem: 3, rel2: 4 },
        ])
      );

      const querySet = new QuerySet({ model: MockedModel as any });
      const res = await querySet.getMany();
      expect(res).toStrictEqual([
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 2 }, true),
        new MockedModel({ id: 2, rel1_id: 3, rel2_id: 4 }, true),
      ]);
    });
  });

  describe("delete", () => {
    const deleteMock = jest.fn();

    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          delete: deleteMock,
        };
      });
    });
    afterEach(() => {
      deleteMock.mockClear();
    });

    it("Should delete objects when passed model instances", async () => {
      deleteMock.mockReturnValue(Promise.resolve());
      new QuerySet({ model: MockedModel as any }).delete();

      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: {},
      });

      new QuerySet({ model: MockedModel as any }).delete();

      expect(deleteMock).toHaveBeenCalledTimes(2);
      expect(deleteMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: {},
      });
    });

    it("Should throw an error when model has no primary field.", async () => {
      try {
        await new QuerySet({ model: MockedModelNoPK as any }).delete();
      } catch (e) {
        expect(e).toStrictEqual(
          new DataOutputError(
            QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD("MockedModelNoPK")
          )
        );
      }
    });

    it("Should throw an error when any object(s), passed, missing the primary field value.", async () => {
      try {
        await new QuerySet({ model: MockedModel as any }).delete();
      } catch (e: any) {
        expect(e).toStrictEqual(
          new DataOutputError(
            QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD("MockedModel")
          )
        );
        expect(e.metaData).toStrictEqual({
          errorObject: new MockedModel({ rel: 1 }),
        });
      }
    });

    it("Should delete the objects in query set if not explicitly passed objects in the params", async () => {
      deleteMock.mockReturnValue(Promise.resolve());
      const querySetObjects = [
        new MockedModel({ id: 1 }),
        new MockedModel({ id: 2 }),
      ];
      await new QuerySet({
        model: MockedModel as any,
        objects: querySetObjects,
      }).delete();

      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: {},
      });
    });

    it("Should also perform validation on query set objects as well when deleting", async () => {
      const querySetObjects = [
        new MockedModel({ id: 1 }),
        new MockedModel({ rel: 2 }),
      ];
      try {
        await new QuerySet({
          model: MockedModel as any,
          objects: querySetObjects,
        }).delete();
      } catch (e: any) {
        expect(e).toStrictEqual(
          new DataOutputError(
            QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD("MockedModel")
          )
        );
        expect(e.metaData).toStrictEqual({
          errorObject: querySetObjects[1],
        });
      }
    });

    it("Should use the filters to delete if objects not passed in param and query set has no objects", async () => {
      deleteMock.mockReturnValue(Promise.resolve);
      await new QuerySet({
        model: MockedModel as any,
        filters: { id: 1 },
      }).delete();
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: { id: 1 },
      });
    });

    it("Should propagate the errors thrown in Connector", async () => {
      deleteMock.mockImplementation(() => {
        const error: any = new Error("Nope");
        error.somethingElse = 10;
        throw error;
      });

      try {
        await new QuerySet({
          model: MockedModel as any,
          filters: { id: 1 },
        }).delete();
      } catch (e: any) {
        expect(e).toStrictEqual(new Error("Nope"));
        expect(e.somethingElse).toStrictEqual(10);
      }
    });
  });

  describe("retrieve", () => {
    const retrieveMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          retrieve: retrieveMock,
        };
      });
    });
    afterEach(() => {
      retrieveMock.mockClear();
    });
    it("Should throw error if model does not have a primary field", async () => {
      try {
        await new QuerySet({ model: MockedModelNoPK as any }).retrieve(1);
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(QUERY_SET_ERRORS.NO_PRIMARY_FIELD("MockedModelNoPK"))
        );
      }
    });

    it("Should throw ResponseDataProcessingError if the response is not valid", async () => {
      retrieveMock.mockReturnValue(Promise.resolve(3));
      try {
        await new QuerySet({ model: MockedModel as any }).retrieve(1);
      } catch (e: any) {
        expect(e).toStrictEqual(
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_INVALID()
          )
        );
        expect(e.metaData).toStrictEqual({
          responseObject: 3,
        });
      }
    });

    it("Should throw ResponseDataProcessingError if the model instantiation fails from response data", async () => {
      retrieveMock.mockReturnValue(Promise.resolve({ id: 1 }));
      try {
        await new QuerySet({ model: MockedModel as any }).retrieve(1);
      } catch (e: any) {
        expect(e).toStrictEqual(
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE()
          )
        );
        expect(e.metaData).toStrictEqual({
          responseObject: { id: 1 },
          error: new ModelParsingError(
            "Failed to create model instance from external data.",
            {}
          ),
          errorObject: { id: 1 },
        });
        expect(e.metaData.error.errors).toStrictEqual({
          rel: "Received a null value for non-nullable field.",
          rel2: "Received a null value for non-nullable field.",
        });
      }
    });

    it("Should return a an instance of the model on success", async () => {
      retrieveMock.mockReturnValue(
        Promise.resolve({ id: 1, ahem: 1, rel2: 2 })
      );

      const res = await new QuerySet({ model: MockedModel as any }).retrieve(1);
      expect(res).toStrictEqual(
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 2 }, true)
      );
    });

    it("Should set objects on query set", async () => {
      retrieveMock.mockReturnValue(
        Promise.resolve({ id: 1, ahem: 1, rel2: 2 })
      );
      const querySet = new QuerySet({ model: MockedModel as any });
      const res = await querySet.retrieve(1);
      expect(querySet.objects).toStrictEqual([
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 2 }, true),
      ]);
      expect(querySet.objects).toStrictEqual([res]);
    });
    it("Should call the IO Connectors retrieve method", async () => {
      retrieveMock.mockReturnValue(
        Promise.resolve({ id: 1, ahem: 1, rel2: 2 })
      );
      await new QuerySet({ model: MockedModel as any }).retrieve(1);
      expect(retrieveMock).toHaveBeenCalledTimes(1);
      expect(retrieveMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        idValue: 1,
      });
    });
  });

  describe("create", () => {
    const createMock = jest.fn();

    const validateDataEmissionError = (
      e: any,
      expectedError: DataEmissionError
    ) => {
      expect(e).toStrictEqual(expectedError);
      expect(e.metaData.errorObject).toStrictEqual(
        expectedError.metaData.errorObject
      );
      expect(e.metaData.error).toStrictEqual(expectedError.metaData.error);
      expect(e.metaData.error.errors).toStrictEqual(
        expectedError.metaData.error?.errors
      );
    };
    const validateResponseDataProcessingerror = (
      e: any,
      expectedError: ResponseDataProcessingError
    ) => {
      expect(e).toStrictEqual(expectedError);
      expect(e.metaData?.responseObject).toStrictEqual(
        expectedError.metaData?.responseObject
      );
      expect(e.metaData.errorObject).toStrictEqual(
        expectedError.metaData?.errorObject
      );
      expect(e.metaData.error).toStrictEqual(expectedError.metaData?.error);
      expect(e.metaData.error?.errors).toStrictEqual(
        expectedError.metaData?.error?.errors
      );
    };
    const validateError = async (
      callback: () => Promise<any>,
      validateErrorCallback: (e: any, expectedError: any) => void,
      expectedError: any
    ) => {
      try {
        await callback();
      } catch (e) {
        validateErrorCallback(e, expectedError);
      }
    };
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          create: createMock,
        };
      });
    });
    afterEach(() => {
      createMock.mockClear();
    });

    it("Should call the create method on IO Connector", async () => {
      createMock.mockReturnValue(Promise.resolve({ id: 1, ahem: 1, rel2: 2 }));
      expect(
        await new QuerySet({ model: MockedModel as any }).create({
          id: 1,
          rel1_id: 1,
          rel2_id: 2,
        })
      ).toStrictEqual(
        new MockedModel(
          {
            id: 1,
            rel1_id: 1,
            rel2_id: 2,
          },
          true
        )
      );
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        object: {
          id: 1,
          ahem: 1,
          rel2: 2,
        },
      });
    });

    it("Should return a model instance with data set to it", async () => {
      createMock.mockReturnValue(
        Promise.resolve({ id: 1000, ahem: 100, rel2: 200 })
      );
      expect(
        await new QuerySet({ model: MockedModel as any }).create({
          id: 1,
          rel1_id: 1,
          rel2_id: 2,
        })
      ).toStrictEqual(
        new MockedModel(
          {
            id: 1000,
            rel1_id: 100,
            rel2_id: 200,
          },
          true
        )
      );
    });

    it("Should send the emitted to to IO Connector", async () => {
      createMock.mockReturnValue(Promise.resolve({ id: 1, ahem: 1, rel2: 2 }));
      expect(
        await new QuerySet({ model: MockedModel as any }).create({
          id: 1,
          rel1_id: 1,
          rel2_id: 2,
        })
      ).toStrictEqual(
        new MockedModel(
          {
            id: 1,
            rel1_id: 1,
            rel2_id: 2,
          },
          true
        )
      );
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        object: {
          id: 1,
          ahem: 1,
          rel2: 2,
        },
      });
    });

    it("Should emit DataValidationError when it fails to validate data", async () => {
      const model = new MockedModel({ rel1_id: 1, rel2_id: 2 });
      try {
        await new QuerySet({ model: MockedModel as any }).create(model);
      } catch (e: any) {
        expect(e).toStrictEqual(
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel "),
            {}
          )
        );
        expect(e.metaData.errorObject).toStrictEqual(model);
        // #ModelError
        expect(e.metaData.error).toStrictEqual(
          new ModelValidationError("Model validation failed.", {})
        );
        // #FieldError
        expect(e.metaData.error.errorsObject).toStrictEqual({
          id: "This field is not nullable.",
        });
      }
      expect(createMock).toHaveBeenCalledTimes(0);
    });
    it("Should throw DataEmission error when it fails to emit data", async () => {
      const instance = new ModelFailsEmission({ id: 1, some: 1 });
      instance.validate();
      await validateError(
        () =>
          new QuerySet({ model: ModelFailsEmission as any }).create({
            id: 1,
            some: 1,
          }),
        validateDataEmissionError,
        new DataEmissionError(
          QUERY_SET_ERRORS.MODEL_DATA_EMIT_FAILED(instance.toString()),
          {
            errorObject: instance,
            // #ModelError
            error: new ModelDataEmitError(
              "Failed to emit data from some fields.",
              {
                // #FieldError
                some: "Something went wrong here.",
              },
              ModelFailsEmission as any
            ),
          }
        )
      );
    });

    it("Should throw ResponseDataProcessingError when it fails to initialize a model instance from IO Connector response", async () => {
      createMock.mockReturnValue(
        Promise.resolve({
          noField: 1,
        })
      );

      try {
        await new QuerySet({ model: MockedModel as any }).create({
          id: 1,
          rel1_id: 1,
          rel2_id: 2,
        });
      } catch (e: any) {
        validateResponseDataProcessingerror(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
            {
              responseObject: {
                noField: 1,
              },

              errorObject: {
                noField: 1,
              },
              // #ModelError
              error: new ModelParsingError(
                "Failed to create model instance from external data.",
                {
                  // #FieldError
                  id: "Received a null value for non-nullable field.",
                  rel: "Received a null value for non-nullable field.",
                  rel2: "Received a null value for non-nullable field.",
                }
              ),
            }
          )
        );
      }
    });

    it("Should throw ResponseDataProcessingError when it invalid non array response from IO Connector response", async () => {
      createMock.mockReturnValue(Promise.resolve(1));

      try {
        await new QuerySet({ model: MockedModel as any }).create({
          id: 1,
          rel1_id: 1,
          rel2_id: 2,
        });
      } catch (e: any) {
        validateResponseDataProcessingerror(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
            {
              responseObject: 1,
              errorObject: 1,
              //   #ModelError
              error: new ModelParsingError(
                "Failed to create model instance from external data.",
                {
                  // #FieldError
                  id: "Received a null value for non-nullable field.",
                  rel: "Received a null value for non-nullable field.",
                  rel2: "Received a null value for non-nullable field.",
                }
              ) as any,
            }
          )
        );
      }
    });
  });

  describe("createObjects", () => {
    const createObjectsMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          createObjects: createObjectsMock,
        };
      });
    });
    afterEach(() => {
      createObjectsMock.mockClear();
    });

    it("Should validate the passed instances", async () => {
      const instance = new MockedModel({});
      const instance2 = new MockedModel({});

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).createObjects([instance, instance2]);
      } catch (e) {
        validateDataValidationError(
          e,
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel "),
            {
              errorObject: instance,
              // #ModelError
              error: new ModelValidationError("Model validation failed.", {
                // #FieldError
                id: "This field is not nullable.",
                rel: "This field is not nullable.",
                rel1_id: "This field is not nullable.",
                rel2: "This field is not nullable.",
                rel2_id: "This field is not nullable.",
              }),
            }
          )
        );
      }
    });

    it("Should call DataEmissionError when the data emitting fails from any model", async () => {
      const instance = new MockedModel({ rel1_id: 1, rel2_id: 2, id: 2 });
      const emiDataSpy = jest.spyOn(instance, "emitData");
      emiDataSpy.mockImplementation(() => {
        throw new Error("aa");
      });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).createObjects([instance, { rel1_id: 1, rel2_id: 2, id: 1 }] as any);
      } catch (e) {
        validateDataEmissionError(
          e,
          new DataEmissionError(
            QUERY_SET_ERRORS.MODEL_DATA_EMIT_FAILED("MockedModel (2)"),
            {
              error: new Error("aa") as any,
              errorObject: instance,
            }
          )
        );
      }
    });

    it("Should validate the passed objects", async () => {
      const instance = new MockedModel({ rel1_id: 1, rel2_id: 2 });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).createObjects([
          { rel1_id: 1, rel2_id: 2 },
          { rel1_id: 1, rel2_id: 2 },
        ] as any);
      } catch (e) {
        validateDataValidationError(
          e,
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel "),
            {
              errorObject: instance,
              // #ModelError
              error: new ModelValidationError("Model validation failed.", {
                // #FieldError
                id: "This field is not nullable.",
              }),
            }
          )
        );
      }
    });

    it("Should call IO Connector's createObjects with emitted data", async () => {
      createObjectsMock.mockReturnValue(
        Promise.resolve([
          { id: 1, ahem: 1, rel2: 3 },
          { id: 2, ahem: 1, rel2: 4 },
        ])
      );

      await new QuerySet({
        model: MockedModel as any,
      }).createObjects([
        { id: 1, rel1_id: 1, rel2_id: 3 },
        { id: 2, rel1_id: 1, rel2_id: 4 },
      ] as any);

      expect(createObjectsMock).toHaveBeenCalledTimes(1);
      expect(createObjectsMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        objects: [
          { id: 1, ahem: 1, rel2: 3 },
          { id: 2, ahem: 1, rel2: 4 },
        ],
      });
    });

    it("Should return created instances", async () => {
      createObjectsMock.mockReturnValue(
        Promise.resolve([
          { id: 1, ahem: 1, rel2: 3 },
          { id: 2, ahem: 1, rel2: 4 },
        ])
      );

      const res = await new QuerySet({
        model: MockedModel as any,
      }).createObjects([
        { id: 1, rel1_id: 1, rel2_id: 3 },
        { id: 2, rel1_id: 1, rel2_id: 4 },
      ] as any);

      expect(res).toStrictEqual([
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 3 }, true),
        new MockedModel({ id: 2, rel1_id: 1, rel2_id: 4 }, true),
      ]);
    });

    it("Should throw ResponseDataParsingError when it receives an invalid response.", async () => {
      createObjectsMock.mockReturnValue(1);

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).createObjects([
          { id: 1, rel1_id: 1, rel2_id: 3 },
          { id: 2, rel1_id: 1, rel2_id: 4 },
        ] as any);
      } catch (e) {
        validateResponseDataParsingError(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_INVALID_ARRAY(),
            {
              responseObject: 1,
            }
          )
        );
      }

      createObjectsMock.mockReturnValue([1]);
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).createObjects([
          { id: 1, rel1_id: 1, rel2_id: 3 },
          { id: 2, rel1_id: 1, rel2_id: 4 },
        ] as any);
      } catch (e) {
        validateResponseDataParsingError(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
            {
              responseObject: [1],
              errorObject: 1,
              //   #ModelError
              error: new ModelParsingError(
                "Failed to create model instance from external data.",
                {
                  // #FieldError
                  id: "Received a null value for non-nullable field.",
                  rel: "Received a null value for non-nullable field.",
                  rel2: "Received a null value for non-nullable field.",
                }
              ),
            }
          )
        );
      }
    });

    it("Should throw an error if the passed object is not an array", async () => {
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).createObjects(1 as any);
      } catch (e) {
        expect(e).toStrictEqual(new Error(QUERY_SET_ERRORS.SHOULD_BE_ARRAY()));
      }
    });
  });

  describe("updateObjects", () => {
    const updateObjectsMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          updateObjects: updateObjectsMock,
        };
      });
    });
    afterEach(() => {
      updateObjectsMock.mockClear();
    });

    it("Should validate the passed instances", async () => {
      const instance = new MockedModel({ id: 1 });
      const instance2 = new MockedModel({ id: 2 });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects([instance, instance2]);
      } catch (e) {
        validateDataValidationError(
          e,
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel (1)"),
            {
              errorObject: instance,
              // #ModelError
              error: new ModelValidationError("Model validation failed.", {
                // #FieldError
                rel: "This field is not nullable.",
                rel1_id: "This field is not nullable.",
                rel2: "This field is not nullable.",
                rel2_id: "This field is not nullable.",
              }),
            }
          )
        );
      }
    });

    it("Should call DataEmissionError when the data emitting fails from any model", async () => {
      const instance = new MockedModel({ rel1_id: 1, rel2_id: 2, id: 2 });
      const emiDataSpy = jest.spyOn(instance, "emitData");
      emiDataSpy.mockImplementation(() => {
        throw new Error("aa");
      });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects([instance, { rel1_id: 1, rel2_id: 2, id: 1 }] as any);
      } catch (e) {
        validateDataEmissionError(
          e,
          new DataEmissionError(
            QUERY_SET_ERRORS.MODEL_DATA_EMIT_FAILED("MockedModel (2)"),
            {
              error: new Error("aa") as any,
              errorObject: instance,
            }
          )
        );
      }
    });

    it("Should validate the passed objects", async () => {
      const instance = new MockedModel({ rel1_id: 1, id: 1 });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects([
          { rel1_id: 1, id: 1 },
          { rel1_id: 1, id: 2 },
        ] as any);
      } catch (e) {
        validateDataValidationError(
          e,
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel (1)"),
            {
              errorObject: instance,
              // #ModelError
              error: new ModelValidationError("Model validation failed.", {
                // #FieldError
                rel2: "This field is not nullable.",
                rel2_id: "This field is not nullable.",
              }),
            }
          )
        );
      }
    });

    it("Should call IO Connector's createObjects with emitted data", async () => {
      updateObjectsMock.mockReturnValue(
        Promise.resolve([
          { id: 1, ahem: 1, rel2: 3 },
          { id: 2, ahem: 1, rel2: 4 },
        ])
      );

      await new QuerySet({
        model: MockedModel as any,
      }).updateObjects([
        { id: 1, rel1_id: 1, rel2_id: 3 },
        { id: 2, rel1_id: 1, rel2_id: 4 },
      ] as any);

      expect(updateObjectsMock).toHaveBeenCalledTimes(1);
      expect(updateObjectsMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        objects: [
          { emittedData: { id: 1, ahem: 1, rel2: 3 }, idValue: 1 },
          { emittedData: { id: 2, ahem: 1, rel2: 4 }, idValue: 2 },
        ],
      });
    });

    it("Should return created instances", async () => {
      updateObjectsMock.mockReturnValue(
        Promise.resolve([
          { id: 1, ahem: 1, rel2: 3 },
          { id: 2, ahem: 1, rel2: 4 },
        ])
      );

      const res = await new QuerySet({
        model: MockedModel as any,
      }).updateObjects([
        { id: 1, rel1_id: 1, rel2_id: 3 },
        { id: 2, rel1_id: 1, rel2_id: 4 },
      ] as any);

      expect(res).toStrictEqual([
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 3 }, true),
        new MockedModel({ id: 2, rel1_id: 1, rel2_id: 4 }, true),
      ]);
    });

    it("Should throw ResponseDataParsingError when it receives an invalid response.", async () => {
      updateObjectsMock.mockReturnValue(1);

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects([
          { id: 1, rel1_id: 1, rel2_id: 3 },
          { id: 2, rel1_id: 1, rel2_id: 4 },
        ] as any);
      } catch (e) {
        validateResponseDataParsingError(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_INVALID_ARRAY(),
            {
              responseObject: 1,
            }
          )
        );
      }

      updateObjectsMock.mockReturnValue([1]);
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects([
          { id: 1, rel1_id: 1, rel2_id: 3 },
          { id: 2, rel1_id: 1, rel2_id: 4 },
        ] as any);
      } catch (e) {
        validateResponseDataParsingError(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
            {
              responseObject: [1],
              errorObject: 1,
              //   #ModelError
              error: new ModelParsingError(
                "Failed to create model instance from external data.",
                {
                  // #FieldError
                  id: "Received a null value for non-nullable field.",
                  rel: "Received a null value for non-nullable field.",
                  rel2: "Received a null value for non-nullable field.",
                }
              ),
            }
          )
        );
      }
    });

    it("Should throw an error if the passed object is not an array", async () => {
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects(1 as any);
      } catch (e) {
        expect(e).toStrictEqual(new Error(QUERY_SET_ERRORS.SHOULD_BE_ARRAY()));
      }
    });

    it("Should error out when trying to update objects of a Model that has no primary field specified.", async () => {
      try {
        await new QuerySet({
          model: MockedModelNoPK as any,
        }).updateObjects([{ some: 1 } as any]);
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(QUERY_SET_ERRORS.NO_PRIMARY_FIELD("MockedModelNoPK"))
        );
      }
    });

    it("Should error out when any instance is missing the primary field.", async () => {
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObjects([
          { rel1_id: 1, rel2_id: 2, id: 2 },
          { rel1_id: 2, rel2_id: 2 },
        ] as any);
      } catch (e) {
        expect(e).toStrictEqual(
          new DataEmissionError(
            QUERY_SET_ERRORS.NO_PRIMARY_FIELD_VALUE_IN_OBJECTS(),
            {
              errorObject: new MockedModel({ rel1_id: 2, rel2_id: 2 }),
            }
          )
        );
      }
    });
  });

  describe("updateObject", () => {
    const updateObjectMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          updateObject: updateObjectMock,
        };
      });
    });
    afterEach(() => {
      updateObjectMock.mockClear();
    });

    it("Should validate the passed instance", async () => {
      const instance = new MockedModel({ id: 1 });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObject(instance);
      } catch (e) {
        validateDataValidationError(
          e,
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel (1)"),
            {
              errorObject: instance,
              // #ModelError
              error: new ModelValidationError("Model validation failed.", {
                // #FieldError
                rel: "This field is not nullable.",
                rel1_id: "This field is not nullable.",
                rel2: "This field is not nullable.",
                rel2_id: "This field is not nullable.",
              }),
            }
          )
        );
      }
    });

    it("Should call DataEmissionError when the data emitting fails from the instance", async () => {
      const instance = new MockedModel({ rel1_id: 1, rel2_id: 2, id: 2 });
      const emiDataSpy = jest.spyOn(instance, "emitData");
      emiDataSpy.mockImplementation(() => {
        throw new Error("aa");
      });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObject(instance);
      } catch (e) {
        validateDataEmissionError(
          e,
          new DataEmissionError(
            QUERY_SET_ERRORS.MODEL_DATA_EMIT_FAILED("MockedModel (2)"),
            {
              error: new Error("aa") as any,
              errorObject: instance,
            }
          )
        );
      }
    });

    it("Should validate the passed object", async () => {
      const instance = new MockedModel({ rel1_id: 1, id: 1 });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObject({ rel1_id: 1, id: 1 } as any);
      } catch (e) {
        validateDataValidationError(
          e,
          new DataValidationError(
            QUERY_SET_ERRORS.MODEL_VALIDATION_FAILED("MockedModel (1)"),
            {
              errorObject: instance,
              // #ModelError
              error: new ModelValidationError("Model validation failed.", {
                // #FieldError
                rel2: "This field is not nullable.",
                rel2_id: "This field is not nullable.",
              }),
            }
          )
        );
      }
    });

    it("Should call IO Connector's createObjects with emitted data", async () => {
      updateObjectMock.mockReturnValue(
        Promise.resolve({ id: 1, ahem: 1, rel2: 3 })
      );

      await new QuerySet({
        model: MockedModel as any,
      }).updateObject({ id: 1, rel1_id: 1, rel2_id: 3 } as any);

      expect(updateObjectMock).toHaveBeenCalledTimes(1);
      expect(updateObjectMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        object: { emittedData: { id: 1, ahem: 1, rel2: 3 }, idValue: 1 },
      });
    });

    it("Should return updated instance", async () => {
      updateObjectMock.mockReturnValue(
        Promise.resolve({ id: 1, ahem: 1, rel2: 3 })
      );

      const res = await new QuerySet({
        model: MockedModel as any,
      }).updateObject({ id: 1, rel1_id: 1, rel2_id: 3 } as any);

      expect(res).toStrictEqual(
        new MockedModel({ id: 1, rel1_id: 1, rel2_id: 3 }, true)
      );
    });

    it("Should throw ResponseDataParsingError when it receives an invalid response.", async () => {
      updateObjectMock.mockReturnValue(1);

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObject({ id: 1, rel1_id: 1, rel2_id: 3 } as any);
      } catch (e) {
        validateResponseDataParsingError(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
            {
              responseObject: 1,
              errorObject: 1,
              error: new ModelParsingError(
                // #ModelError
                "Failed to create model instance from external data.",
                {
                  // #FieldError
                  id: "Received a null value for non-nullable field.",
                  rel: "Received a null value for non-nullable field.",
                  rel2: "Received a null value for non-nullable field.",
                }
              ),
            }
          )
        );
      }

      updateObjectMock.mockReturnValue(1);
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObject({ id: 1, rel1_id: 1, rel2_id: 3 } as any);
      } catch (e) {
        validateResponseDataParsingError(
          e,
          new ResponseDataProcessingError(
            QUERY_SET_ERRORS.IO_RESPONSE_FAILED_TO_INITIALIZE(),
            {
              responseObject: 1,
              errorObject: 1,
              //   #ModelError
              error: new ModelParsingError(
                "Failed to create model instance from external data.",
                {
                  // #FieldError
                  id: "Received a null value for non-nullable field.",
                  rel: "Received a null value for non-nullable field.",
                  rel2: "Received a null value for non-nullable field.",
                }
              ),
            }
          )
        );
      }
    });

    it("Should error out when trying to update objects of a Model that has no primary field specified.", async () => {
      try {
        await new QuerySet({
          model: MockedModelNoPK as any,
        }).updateObject({ some: 1 } as any);
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(QUERY_SET_ERRORS.NO_PRIMARY_FIELD("MockedModelNoPK"))
        );
      }
    });

    it("Should error out when instance is missing the primary field.", async () => {
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).updateObject({ rel1_id: 1, rel2_id: 2 } as any);
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(QUERY_SET_ERRORS.NO_PRIMARY_FIELD_VALUE())
        );
      }
    });
  });

  describe("deleteObjects", () => {
    const deleteObjectsMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          deleteObjects: deleteObjectsMock,
        };
      });
    });
    afterEach(() => {
      deleteObjectsMock.mockClear();
    });

    it("Should throw DataEmissionError error if the model does not have primary field specified", async () => {
      try {
        await new QuerySet({
          model: MockedModelNoPK as any,
        }).deleteObjects([{}] as any);
      } catch (e) {
        validateDataEmissionError(
          e,
          new DataEmissionError(
            QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD("MockedModelNoPK"),
            {}
          )
        );
      }
    });

    it("Should throw an error if the param is not an array", async () => {
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).deleteObjects(1 as any);
      } catch (e) {
        expect(e).toStrictEqual(new Error(QUERY_SET_ERRORS.SHOULD_BE_ARRAY()));
      }
    });

    it("Should throw DataEmissionError if any of the object is missing the primary field value", async () => {
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).deleteObjects([{ id: 1 }, { rel1_id: 2 }] as any);
      } catch (e) {
        validateDataEmissionError(
          e,
          new DataEmissionError(
            QUERY_SET_ERRORS.CANNOT_DELETE_NO_PRIMARY_FIELD_VALUE(
              "MockedModel"
            ),
            {
              errorObject: new MockedModel({ rel1_id: 2 }),
            }
          )
        );
      }
    });

    it("Should call the IO Connector's deleteObjects method with object ids", async () => {
      deleteObjectsMock.mockReturnValue(Promise.resolve());

      await new QuerySet({
        model: MockedModel as any,
      }).deleteObjects([{ id: 2 }, { id: 1000 }] as any);

      expect(deleteObjectsMock).toHaveBeenCalledTimes(1);
      expect(deleteObjectsMock).toHaveBeenCalledWith({
        objectIDs: [2, 1000],
        ModelClass: MockedModel,
      });
    });

    it("Should pipe the Error thrown in IO Connector as it is", async () => {
      deleteObjectsMock.mockImplementation(() => {
        throw new Error("eee1");
      });

      try {
        await new QuerySet({
          model: MockedModel as any,
        }).deleteObjects([{ id: 2 }, { id: 1000 }] as any);
      } catch (e) {
        expect(e).toStrictEqual(new Error("eee1"));
      }
    });
  });

  describe("update", () => {
    const updateMock = jest.fn();
    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          update: updateMock,
        };
      });
    });
    afterEach(() => {
      updateMock.mockClear();
    });

    it("Should throw an error if the passed object in params is not an object", async () => {
      try {
        await new QuerySet({ model: MockedModel as any }).update(1 as any);
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(QUERY_SET_ERRORS.INVALID_MODEL_VALUES_OBJECT())
        );
      }
    });

    it("Should throw an error if the passed object in params is not initialize-able as model instance", async () => {
      try {
        await new QuerySet({ model: MockedModel as any }).update({
          noField: 1,
        });
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(
            QUERY_SET_ERRORS.INVALID_UPDATE_OBJECT(
                // #ModelError
              "Field noField does not exist on MockedModel"
            )
          )
        );
      }
    });

    it("Should throw DataValidationError when the pass object is not partially validate-able.", async () => {
      try {
        await new QuerySet({ model: ModelFailsValidation as any }).update({
          some: 1,
        });
        throw new Error("Should have throw DataEmissionError.");
      } catch (e) {
        validateDataValidationError(
          e,
        //   #ModelError
          new DataValidationError("Model validation failed.", {
            error: new ModelValidationError("Model validation failed.", {
              some: "Something is up.",
            }),
            errorObject: new ModelFailsValidation({ some: 1 }),
          })
        );
      }
    });

    it("Should throw DataEmissionError when the model fails to emit data for partial fields", async () => {
      const instance = new ModelFailsEmission({ some: 1 });

      try {
        await new QuerySet({
          model: ModelFailsEmission as any,
        }).update({ some: 1 });
      } catch (e) {
        validateDataEmissionError(
          e,
        //   #ModelError
          new DataEmissionError("Failed to emit data from some fields.", {
            error: new ModelDataEmitError(
              "Failed to emit data from some fields.",
              {
                some: "Something went wrong here.",
              },
              ModelDataEmitError as any
            ),
            errorObject: instance,
          })
        );
      }
    });

    it("Should call the IO Connector's update method with partial model emitted data", async () => {
      updateMock.mockReturnValue(Promise.resolve());

      await new QuerySet({ model: MockedModel as any }).update({
        rel1_id: 1,
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: {},
        modelData: {
          ahem: 1,
        },
      });
    });

    it("Should call the IO Connector's update method with filters if set", async () => {
      updateMock.mockReturnValue(Promise.resolve());

      await new QuerySet({
        model: MockedModel as any,
        filters: { id: 2 },
      }).update({
        rel1_id: 1,
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith({
        ModelClass: MockedModel,
        filters: { id: 2 },
        modelData: {
          ahem: 1,
        },
      });
    });

    it("Should pipe the error as it is which may get thrown in the IO Connector", async () => {
      updateMock.mockImplementation(() => {
        throw new Error("SomeUp");
      });
      try {
        await new QuerySet({
          model: MockedModel as any,
        }).update({
          rel1_id: 1,
        });
      } catch (e) {
        expect(e).toStrictEqual(new Error("SomeUp"));
      }
    });
  });

  describe("fetchRelated", () => {
    const listMock = jest.fn();

    beforeEach(() => {
      (getIOConnector as any).mockImplementation(() => {
        return {
          list: listMock,
        };
      });
    });

    afterEach(() => {
      listMock.mockClear();
    });

    it("should call every query set with ID filter", async () => {
      listMock.mockImplementation(({ ModelClass }) => {
        if (ModelClass === MockedRelatedModel) {
          return Promise.resolve([{ id: 1 }, { id: 3 }, { id: 5 }]);
        } else {
          return Promise.resolve([{ id: 2 }, { id: 4 }, { id: 6 }]);
        }
      });

      const querySet = new QuerySet({
        model: MockedModel as any,
        objects: [
          new MockedModel({ id: 1, rel1_id: 1, rel2_id: 2 }),
          new MockedModel({ id: 1, rel1_id: 3, rel2_id: 4 }),
          new MockedModel({ id: 1, rel1_id: 5, rel2_id: 6 }),
        ] as any,
        prefetchRelatedFields: ["rel", "rel2"],
      });
      await querySet.fetchRelatedFields();

      expect(listMock).toHaveBeenCalledTimes(2);
      expect(listMock).toHaveBeenNthCalledWith(1, {
        ModelClass: MockedRelatedModel,
        filters: { id__in: [1, 3, 5] },
      });
      expect(listMock).toHaveBeenNthCalledWith(2, {
        ModelClass: MockedRelatedModel1,
        filters: { id__in: [2, 4, 6] },
      });
    });

    it("Should attach related instances to objects", async () => {
      listMock.mockImplementation(({ ModelClass }) => {
        if (ModelClass === MockedRelatedModel) {
          return Promise.resolve([{ id: 1 }, { id: 3 }, { id: 5 }]);
        } else {
          return Promise.resolve([{ id: 2 }, { id: 4 }, { id: 6 }]);
        }
      });

      const querySet = new QuerySet({
        model: MockedModel as any,
        objects: [
          new MockedModel({ id: 1, rel1_id: 1, rel2_id: 2 }),
          new MockedModel({ id: 1, rel1_id: 3, rel2_id: 4 }),
          new MockedModel({ id: 1, rel1_id: 5, rel2_id: 6 }),
        ] as any,
        prefetchRelatedFields: ["rel", "rel2"],
      });
      await querySet.fetchRelatedFields();

      expect(listMock).toHaveBeenCalledTimes(2);
      expect(listMock).toHaveBeenNthCalledWith(1, {
        ModelClass: MockedRelatedModel,
        filters: { id__in: [1, 3, 5] },
      });
      expect(listMock).toHaveBeenNthCalledWith(2, {
        ModelClass: MockedRelatedModel1,
        filters: { id__in: [2, 4, 6] },
      });

      expect(querySet.objects[0].data.rel).toStrictEqual(
        new MockedRelatedModel({ id: 1 }, true)
      );
      expect(querySet.objects[1].data.rel).toStrictEqual(
        new MockedRelatedModel({ id: 3 }, true)
      );
      expect(querySet.objects[2].data.rel).toStrictEqual(
        new MockedRelatedModel({ id: 5 }, true)
      );

      expect(querySet.objects[0].data.rel2).toStrictEqual(
        new MockedRelatedModel1({ id: 2 }, true)
      );
      expect(querySet.objects[1].data.rel2).toStrictEqual(
        new MockedRelatedModel1({ id: 4 }, true)
      );
      expect(querySet.objects[2].data.rel2).toStrictEqual(
        new MockedRelatedModel1({ id: 6 }, true)
      );
    });
  });
});

const validateDataValidationError = (
  thrownError: any,
  expectedError: DataValidationError
) => {
  expect(thrownError).toStrictEqual(expectedError);
  if (expectedError.metaData.error) {
    expect(thrownError.metaData?.error).toStrictEqual(
      expectedError.metaData?.error
    );
    expect(thrownError.metaData?.error?.errorsObject).toStrictEqual(
      expectedError.metaData?.error?.errorsObject
    );
  }
};

const validateDataEmissionError = (
  thrownError: any,
  expectedError: DataEmissionError
) => {
  expect(thrownError).toStrictEqual(expectedError);
  expect(thrownError.metaData).toStrictEqual(expectedError.metaData);
  if (expectedError.metaData.error) {
    expect(thrownError.metaData?.error).toStrictEqual(
      expectedError.metaData?.error
    );
    expect(thrownError.metaData?.error?.errors).toStrictEqual(
      expectedError.metaData?.error?.errors
    );
  }
};
const validateResponseDataParsingError = (
  thrownError: any,
  expectedError: ResponseDataProcessingError
) => {
  expect(thrownError).toStrictEqual(expectedError);
  expect(thrownError.metaData).toStrictEqual(expectedError.metaData);
  if (expectedError.metaData?.error) {
    expect(thrownError.metaData?.error).toStrictEqual(
      expectedError.metaData?.error
    );
    expect(thrownError.metaData?.error?.errors).toStrictEqual(
      expectedError.metaData?.error?.errors
    );
  }
};
