import { RelatedField } from "../RelatedField";
import { Model } from "../../Model";
import { IntegerField } from "../NumberFields";
import { MODEL_ACTIONS } from "../../utils";
import { ModelFieldValidationError } from "../ModelFieldValidationError";
import { TextField } from "../TextFields";

class MockedRelatedModel extends Model {
  getName(): string {
    return "MockedModel";
  }
  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
    };
  }
}

class MockedModel extends Model {
    getName(): string {
        return 'MockedModel'
    }

  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
      customer: new RelatedField({
        field: "customer_id",
        model: MockedRelatedModel,
      }),
    };
  }
}

class MockedNonModel {}

class ModelWithoutPK extends Model {
    getName(): string {
        return 'ModelWithoutPK'
    }
  fields() {
    return {
      name: new TextField({}),
    };
  }
}

describe("RelatedField", () => {
  describe("constructor", () => {
    it("Should check required Parameters", () => {
      expect(() => new RelatedField({} as any)).toThrow(
        new Error("Model is required in the config.")
      );
      expect(() => new RelatedField({ model: MockedModel } as any)).toThrow(
        new Error("Field name is required in the config.")
      );
    });

    it("Should set the model and field correctly correctly", () => {
      expect(
        new RelatedField({
          model: MockedModel,
          field: "customer_id",
        }).model
      ).toBe(MockedModel);
      expect(
        new RelatedField({
          model: MockedModel,
          field: "customer_id",
        }).field
      ).toBe("customer_id");
    });

    it("Cannot be primaryField", () => {
      expect(
        new RelatedField({
          model: MockedModel,
          field: "customer_id",
        }).primaryField
      ).toBe(false);
    });

    it("Should validate the model class", () => {
      expect(
        () =>
          new RelatedField({
            model: MockedNonModel as any,
            field: "customer_id",
          })
      ).toThrow(
        new Error(
          "Invalid model in the config. Class passed should extend the Model class."
        )
      );

      expect(
        () =>
          new RelatedField({
            model: parseInt as any,
            field: "customer_id",
          })
      ).toThrow(/Invalid model in the config./);
    });

    it("Should validate whether the related model has primary field", () => {
      expect(
        () => new RelatedField({ model: ModelWithoutPK, field: "customer" })
      ).toThrow(
        "Invalid model in the config. ModelWithoutPK does not have a primary field and cannot be used as a related field."
      );
    });
  });

  describe("validate", () => {
    it("Should inherit other field functionality", () => {
      expect(
        new RelatedField({
          model: MockedModel,
          field: "customer_id",
          nullable: true,
        }).validate({
          fieldName: "customer_id",
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: undefined,
        })
      ).toBe(null);
      expect(
        new RelatedField({
          model: MockedModel,
          field: "customer_id",
          nullable: true,
        }).validate({
          fieldName: "customer",
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: undefined,
        })
      ).toBe(null);
    });

    it("Should validate the ID value only if present", () => {
      expect(
        new RelatedField({
          field: "customer_id",
          model: MockedRelatedModel,
        }).validate({
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          fieldName: "customer_id",
          modelInstance: new MockedModel({ customer_id: 1 }),
          value: 1,
        })
      ).toBe(1);
    });

    it("Should validate the related field instance", () => {
      const relatedFieldValue = new MockedRelatedModel({ id: 1 });
      expect(
        new RelatedField({
          field: "customer_id",
          model: MockedRelatedModel,
        }).validate({
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          fieldName: "customer",
          modelInstance: new MockedModel({ customer_id: 1 }),
          value: relatedFieldValue,
        })
      ).toBe(null);

      expect(() =>
        new RelatedField({
          field: "customer_id",
          model: MockedRelatedModel,
        }).validate({
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          fieldName: "customer",
          modelInstance: new MockedModel({ customer_id: 1, customer: 1 }),
          value: 1,
        })
      ).toThrow(
        new ModelFieldValidationError(
          "Must be an instance of MockedRelatedModel.",
          "customer"
        )
      );
    });

    it("Should validate that the instance has primary field value", () => {
      expect(() =>
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).validate({
          fieldName: "customer",
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: new MockedModel({
            customer: new MockedRelatedModel({}),
          }),
        })
      );
    });
  });

  describe("processIOObject", () => {
    it("Should set the ID field correctly", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).fromIOObject({
          ioObject: {
            customer: 1,
          },
          modelInstance: new MockedModel({}),
          name: "customer",
        })
      ).toEqual({
        customer_id: 1,
        customer: null,
      });

      const instance = new MockedRelatedModel({ id: 1 });
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).fromIOObject({
          ioObject: {
            customer: instance,
          },
          modelInstance: new MockedModel({}),
          name: "customer",
        })
      ).toEqual({
        customer_id: 1,
        customer: instance,
      });
    });

    it("If instance has no primary field value, it should set the id field to null", () => {
      const instance = new MockedRelatedModel({});
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).fromIOObject({
          ioObject: {
            customer: instance,
          },
          modelInstance: new MockedModel({}),
          name: "customer",
        })
      ).toEqual({
        customer_id: null,
        customer: instance,
      });
    });

    it("if the value is not an instance, set id value and field to null", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).fromIOObject({
          ioObject: {
            customer: new MockedNonModel(),
          },
          modelInstance: new MockedModel({}),
          name: "customer",
        })
      ).toEqual({
        customer_id: new MockedNonModel(),
        customer: null,
      });
    });

    it("Should process the null object", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
          nullable: true,
        }).fromIOObject({
          ioObject: { customer: null },
          modelInstance: new MockedModel({}),
          name: "customer",
        })
      ).toEqual({
        customer: null,
        customer_id: null,
      });
    });

    it("Should throw if the field not nullable but the value is null", () => {
      expect(() =>
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).fromIOObject({
          ioObject: { customer: null },
          modelInstance: new MockedModel({}),
          name: "customer",
        })
      ).toThrow("Received a null value for non-nullable field.");
    });
  });

  describe("watchFields", () => {
    it("should return name and the field name to watch", () => {
      expect(
        new RelatedField({ model: MockedModel, field: "c" }).watchFields("a")
      ).toEqual(["a", "c"]);
    });
  });

  describe("emitValue", () => {
    it("Should emit id value when the instance is present", () => {
      expect(
        new RelatedField({ model: MockedRelatedModel, field: "idf" }).emitValue(
          {
            name: "customer",
            modelAction: MODEL_ACTIONS.CREATE,
            modelInstance: new MockedModel({}),
            value: new MockedRelatedModel({ id: 1 }),
          }
        )
      ).toStrictEqual({
        customer: 1,
      });
    });

    it("Should emit id value when the id value is present and model instance is not", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).emitValue({
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({ customer_id: 1 }),
          value: 1,
        })
      ).toStrictEqual({
        customer: 1,
      });
    });

    it("should emit null when nothing is present", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).emitValue({
          name: "customer",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({ customer_id: null }),
          value: null,
        })
      ).toStrictEqual({
        customer: null,
      });
    });
  });

  describe("setValue", () => {
    it("should set the id value when instance is set", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer",
          modelInstance: new MockedModel({}),
          value: new MockedRelatedModel({ id: 1 }),
        })
      ).toStrictEqual({
        customer: new MockedRelatedModel({ id: 1 }),
        customer_id: 1,
      });
    });

    it("should unset instance value when id value is set and is not the same id", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer_id",
          modelInstance: new MockedModel({}),
          value: 1,
        })
      ).toStrictEqual({
        customer: null,
        customer_id: 1,
      });

      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer_id",
          modelInstance: new MockedModel({
            customer: new MockedRelatedModel({ id: 1 }),
          }),
          value: 1,
        })
      ).toStrictEqual({
        customer: new MockedRelatedModel({ id: 1 }),
        customer_id: 1,
      });
    });

    it("should not set id value when instance is invalid", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer",
          modelInstance: new MockedModel({}),
          value: new MockedModel({}),
        })
      ).toStrictEqual({
        customer: new MockedModel({}),
        customer_id: null,
      });
    });

    it("should not set id value when instance does not have primary field value", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer",
          modelInstance: new MockedModel({}),
          value: new MockedRelatedModel({}),
        })
      ).toStrictEqual({
        customer: new MockedRelatedModel({}),
        customer_id: null,
      });
    });

    it("null checks", () => {
      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer",
          modelInstance: new MockedModel({}),
          value: null,
        })
      ).toStrictEqual({
        customer: null,
        customer_id: null,
      });

      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer_id",
          modelInstance: new MockedModel({}),
          value: null,
        })
      ).toStrictEqual({
        customer: null,
        customer_id: null,
      });

      expect(
        new RelatedField({
          model: MockedRelatedModel,
          field: "customer_id",
        }).setValue({
          name: "customer",
          fieldName: "customer_id",
          modelInstance: new MockedModel({
            customer: new MockedRelatedModel({}),
          }),
          value: null,
        })
      ).toStrictEqual({
        customer: new MockedRelatedModel({}),
        customer_id: null,
      });
    });
  });
});
