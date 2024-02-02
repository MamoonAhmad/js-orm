import { Model } from "../Model";
import { QuerySet } from "../QuerySet";
import { RelatedField } from "../fields/RelatedField";
import { IntegerField } from "../fields/NumberFields";
import { TextField } from "../fields/TextFields";
import { Field } from "../fields/Field";
import { ModelDataEmitError, ModelParsingError, ModelValidationError } from "../ModelErrors";
import { ModelFieldValidationError } from "../fields/ModelFieldValidationError";
import { MODEL_ACTIONS } from "../utils";

jest.mock(".././QuerySet");

class MockedModel extends Model {
  getName(): string {
    return "MockedModel";
  }
  fields() {
    return {
      id: new IntegerField({}),
      name: new TextField({}),
    };
  }
}

class MockedNonFieldsModel extends Model {
  getName(): string {
    return "MockedNonFieldsModel";
  }

  fields() {
    return {};
  }
}

class MockedTwoPrimaryFieldsModel extends Model {
  getName(): string {
    return "MockedTwoPrimaryFieldsModel";
  }

  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
      some: new IntegerField({ primaryField: true }),
    };
  }
}

class MockedModelWithPK extends Model {
  getName(): string {
    return "MockedModelWithPKDifferent";
  }

  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
      some: new TextField({}),
    };
  }

  static endpoint(): string {
    return "MockedModelWithPK__Endpoint";
  }
}

class MockedRelatedModel extends Model {
  getName(): string {
    return "MockedRelatedModel";
  }
  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
    };
  }
}

class MockedModelWithRelation extends Model {
  getName(): string {
    return "MockedModelWithRelation";
  }
  fields() {
    return {
      id: new IntegerField({ primaryField: true }),
      customer: new RelatedField({
        model: MockedRelatedModel,
        field: "customer_id",
        ioName: "some",
      }),
    };
  }
}

class MockedField extends Field {
  emitValue(): Record<string, any> {
    throw new Error("Something went wrong here.");
  }
  validate() {
    throw new Error("Something went wrong here in validate.");
  }
  watchFields(name: string): string[] {
    return [name, "somethingElse"];
  }
}

class MockedModelWithMockField extends Model {
  getName(): string {
    return "MockedModelWithMockField";
  }
  fields() {
    return {
      id: new IntegerField({}),
      some: new MockedField({}),
    };
  }
}

class MockedModelWithMultipleMockFields extends Model {
  getName(): string {
    return "MockedModelWithMockField";
  }
  fields() {
    return {
      id: new IntegerField({}),
      some: new MockedField({}),
      some1: new MockedField({}),
      some2: new MockedField({}),
    };
  }
}

describe("Model", () => {
  describe("constructor", () => {
    it("Should set the data correctly", () => {
      expect(new MockedModel({ id: 1 }).data.id).toBe(1);
      expect(new MockedModel({ id: 1 }).data.name).toBe(undefined);
      expect(new MockedModel({ id: 1, name: "some" }).data.name).toBe("some");
      expect(new MockedModel({ id: 1, name: "some" }).data.id).toBe(1);
    });

    it("Should check that the model returns at least one field", () => {
      expect(() => new MockedNonFieldsModel({})).toThrow(
        "MockedNonFieldsModel does not have any fields defined."
      );
    });

    it("Should throw if model return two primary fields", () => {
      expect(() => new MockedTwoPrimaryFieldsModel({})).toThrow(
        "MockedTwoPrimaryFieldsModel has more than one primary field. The can only be one primary field."
      );
    });
  });

  describe("hasPrimaryField", () => {
    it("Should return correct value", () => {
      expect(new MockedModel({}).hasPrimaryField).toBe(false);
      expect(new MockedModelWithPK({}).hasPrimaryField).toBe(true);
    });
  });

  describe("endpoint", () => {
    it("Should throw if not implemented", () => {
      expect(() => MockedModel.endpoint()).toThrow(
        "Endpoint method is not implemented."
      );
      expect(MockedModelWithPK.endpoint()).toBe("MockedModelWithPK__Endpoint");
    });
  });

  describe("getName", () => {
    it("Should get correct model name", () => {
      expect(new MockedModel({}).getName()).toBe("MockedModel");
      expect(new MockedModelWithPK({}).getName()).toBe(
        "MockedModelWithPKDifferent"
      );
    });
  });

  describe("getPrimaryField", () => {
    it("Should get the correct primary field and name", () => {
      expect(new MockedModelWithPK({}).getPrimaryField()).toStrictEqual([
        "id",
        new IntegerField({ primaryField: true }),
      ]);

      expect(new MockedModel({}).getPrimaryField()).toStrictEqual(null);
    });
  });

  describe("getPrimaryFieldValue", () => {
    it("Should get the correct primary field value", () => {
      expect(
        new MockedModelWithPK({ id: 1 }).getPrimaryFieldValue()
      ).toStrictEqual(1);
      expect(new MockedModelWithPK({}).getPrimaryFieldValue()).toStrictEqual(
        null
      );
    });
  });

  describe("objects", () => {
    it("Should return query set with model attached", () => {
      const querySetInstance = new QuerySet({
        model: MockedModelWithPK as any,
      });
      (QuerySet as any).mockImplementation(() => querySetInstance);
      expect(MockedModel.objects).toBe(querySetInstance);
      expect(MockedModelWithPK.objects).toBe(querySetInstance);
    });
  });

  describe("emitData", () => {
    it("should emit data correctly", () => {
      expect(
        new MockedModelWithPK({
          id: 1,
        }).emitData()
      ).toStrictEqual({
        id: 1,
        some: null,
      });

      expect(
        new MockedModelWithPK({
          id: 1,
          some: "something",
        }).emitData()
      ).toStrictEqual({
        id: 1,
        some: "something",
      });
    });

    it("Preserves the ioNames emitted by Field", () => {
      expect(
        new MockedModelWithRelation({
          customer_id: 1,
        }).emitData()
      ).toStrictEqual({
        id: null,
        some: 1,
      });
    });

    it("When any field fails to emit data, throw ModelDataEmitError", () => {
      expect(() => new MockedModelWithMockField({ id: 1 }).emitData()).toThrow(
        "Failed to emit data from some fields."
      );
      expect(() => new MockedModelWithMockField({ id: 1 }).emitData()).toThrow(
        ModelDataEmitError
      );
    });
    it("When error is throw, should only show error for fields that have errors", () => {
      try {
        new MockedModelWithMockField({ id: 1 }).emitData();
      } catch (e: any) {
        expect(e.message).toBe("Failed to emit data from some fields.");
        expect(e.errors).toStrictEqual({ some: "Something went wrong here." });
      }

      try {
        new MockedModelWithMultipleMockFields({ id: 1 }).emitData();
      } catch (e: any) {
        expect(e.message).toBe("Failed to emit data from some fields.");
        expect(e.errors).toStrictEqual({
          some: "Something went wrong here.",
          some1: "Something went wrong here.",
          some2: "Something went wrong here.",
        });
      }
    });
  });

  describe("save", () => {
    it("Should call query set's create method when the model is not already saved.", async () => {
      const querySetInstance = new QuerySet({
        model: MockedModelWithPK as any,
      });
      const createMock = jest.spyOn(querySetInstance, "create");
      createMock.mockReturnValue(Promise.resolve(new MockedModelWithPK({})));

      const instance = new MockedModelWithPK({ some: "thing", id: 1 });
      await instance.save();
      expect(createMock).toHaveBeenCalledWith(instance);
    });

    it("Should call query set's update method when the model is already saved.", async () => {
      const querySetInstance = new QuerySet({
        model: MockedModelWithPK as any,
      });
      const instance = new MockedModelWithPK({ some: "thing", id: 1 }, true);
      
      const updateMock = jest.spyOn(querySetInstance, "updateObject");
      updateMock.mockReturnValue(Promise.resolve(instance));

      
      await instance.save();
      expect(updateMock).toHaveBeenCalledWith(instance);
    });

    it("Should throw error as it is (in the process).", async () => {
      const querySetInstance = new QuerySet({
        model: MockedModelWithPK as any,
      });
      const updateMock = jest.spyOn(querySetInstance, "update");

      updateMock.mockImplementation(() => {
        throw new Error("Bla1");
      });

      try {
        await new MockedModelWithPK({ some: "thing", id: 1 }, true).save();
      } catch (e) {
        expect(e).toStrictEqual(new Error("Bla1"));
      }

      updateMock.mockImplementation(() => {
        throw new ModelFieldValidationError("Bla1", "FieldBla1");
      });

      try {
        await new MockedModelWithPK({ some: "thing", id: 1 }, true).save();
      } catch (e) {
        expect(e).toStrictEqual(
          new ModelFieldValidationError("Bla1", "FieldBla1")
        );
      }
    });

    it("Should throw error if the model is saved but has no primary field. ", () => {
      try {
        () => new MockedModel({ id: 1, name: "1" }, true).save();
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(
            "Cannot save a model without primary field. Specify a primary field in the config when initiating the fields."
          )
        );
      }
    });

    // should call the query set's create method when model is not already saved
    // should not mask the error in the transaction
    // show throw error if there is no primary field on the model and the object is already saved
  });

  describe("delete", () => {
    it("Should throw an error when the model has no primary field", async () => {
      try {
        await new MockedModel({ id: 1 }, true).delete();
      } catch (e) {
        expect(e).toStrictEqual(
          new Error(
            "Cannot delete a model without primary field. Specify a primary field in the config when initiating the field."
          )
        );
      }
    });

    it("Should throw an error when the instance does not have a primary field value", async () => {
      try {
        await new MockedModelWithPK({}, true).delete();
      } catch (e) {
        expect(e).toStrictEqual(
          new Error("Instance does not have primary field value.")
        );
      }
    });

    it("Should throw an error when the instance does not have a primary field value", async () => {
      const querySetInstance = new QuerySet({
        model: MockedModelWithPK as any,
      });

      const deleteMock = jest.spyOn(querySetInstance, "deleteObject");
      deleteMock.mockResolvedValue(Promise.resolve());
      const instance = new MockedModelWithPK({ id: 1 }, true);
      await instance.delete();

      expect(deleteMock).toHaveBeenCalledWith(instance);
    });
  });

  describe("validate", () => {
    it("Should throw ModelValidationError if any field is invalid", () => {
      try {
        new MockedModel({}).validate();
        throw new Error("Did not throw ModelValidationError");
      } catch (e: any) {
        expect(e).toStrictEqual(
          new ModelValidationError("Model validation failed.", {})
        );
        expect(e?.constructor).toBe(ModelValidationError);
      }
    });

    it("Should specify fields on which errors were thrown", () => {
      try {
        new MockedModel({}).validate();
        throw new Error("Did not throw ModelValidationError");
      } catch (e: any) {
        expect(e?.errorsObject).toStrictEqual({
          id: "This field is not nullable.",
          name: "This field is not nullable.",
        });
      }
    });

    it("Should show errors on fields watched by fields as well.", () => {
      try {
        new MockedModelWithMockField({}).validate();
      } catch (e: any) {
        expect(e).toStrictEqual(
          new ModelValidationError("Model validation failed.", {})
        );
        expect(e.errorsObject).toStrictEqual({
          id: "This field is not nullable.",
          some: "Something went wrong here in validate.",
          somethingElse: "Something went wrong here in validate.",
        });
      }
    });

    it("Should call every field validate with its value. It should also call the field watching fields", () => {
      const field = new MockedField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: field,
        } as any);

      const modelInstance = new MockedModelWithMockField({ somethingElse: 1 });
      modelInstance.fields = () =>
        ({
          some: field,
        } as any);
      const validateSpy = jest.spyOn(field, "validate");

      try {
        modelInstance.validate();
      } catch (e: any) {
        expect(validateSpy).toHaveBeenCalledTimes(2);
        expect(validateSpy).toHaveBeenNthCalledWith(1, {
          name: "some",
          fieldName: "some",
          modelInstance,
          modelAction: MODEL_ACTIONS.CREATE,
          value: undefined,
        });
        expect(validateSpy).toHaveBeenNthCalledWith(2, {
          name: "some",
          fieldName: "somethingElse",
          modelInstance,
          modelAction: MODEL_ACTIONS.CREATE,
          value: 1,
        });
      }
    });

    it("Should set validated values for on the instance", () => {
      MockedField.prototype.validate = ((props: any) =>
        props.fieldName === "somethingElse" ? "somethingElse" : "10") as any;
      const field = new MockedField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: field,
          id: new IntegerField({ nullable: true }),
        } as any);

      const modelInstance = new MockedModelWithMockField({ id: 100 });

      modelInstance.validate();
      expect(modelInstance.data).toStrictEqual({
        id: 100,
        some: "10",
        somethingElse: "somethingElse",
      });
    });

    it("Should set validated values for the watched fields as well", () => {
      const originalValidate = MockedField.prototype.validate;
      MockedField.prototype.validate = ((props: any) =>
        props.fieldName === "somethingElse" ? "somethingElse" : "10") as any;
      const field = new MockedField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: field,
          id: new IntegerField({ nullable: true }),
        } as any);

      const modelInstance = new MockedModelWithMockField({ somethingElse: 1 });

      modelInstance.validate();
      expect(modelInstance.data).toStrictEqual({
        id: null,
        some: "10",
        somethingElse: "somethingElse",
      });
      MockedField.prototype.validate = originalValidate;
    });

    it("Should pass the correct model action", () => {
      MockedField.prototype.validate = ((p: any) => p.value) as any;
      const field = new MockedField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: field,
          id: new IntegerField({ nullable: true }),
        } as any);

      const validateMock = jest.spyOn(field, "validate");

      let modelInstance = new MockedModelWithMockField({});
      modelInstance.validate();
      expect(validateMock).toHaveBeenNthCalledWith(1, {
        name: "some",
        fieldName: "some",
        modelInstance,
        modelAction: MODEL_ACTIONS.CREATE,
        value: undefined,
      });
      expect(validateMock).toHaveBeenNthCalledWith(2, {
        name: "some",
        fieldName: "somethingElse",
        modelInstance,
        modelAction: MODEL_ACTIONS.CREATE,
        value: undefined,
      });

      modelInstance = new MockedModelWithMockField({}, true);
      modelInstance.validate();
      expect(validateMock).toHaveBeenNthCalledWith(3, {
        name: "some",
        fieldName: "some",
        modelInstance,
        modelAction: MODEL_ACTIONS.UPDATE,
        value: undefined,
      });
      expect(validateMock).toHaveBeenNthCalledWith(4, {
        name: "some",
        fieldName: "somethingElse",
        modelInstance,
        modelAction: MODEL_ACTIONS.UPDATE,
        value: undefined,
      });

      modelInstance.validate(MODEL_ACTIONS.LIST);

      expect(validateMock).toHaveBeenNthCalledWith(5, {
        name: "some",
        fieldName: "some",
        modelInstance,
        modelAction: MODEL_ACTIONS.LIST,
        value: undefined,
      });
      expect(validateMock).toHaveBeenNthCalledWith(6, {
        name: "some",
        fieldName: "somethingElse",
        modelInstance,
        modelAction: MODEL_ACTIONS.LIST,
        value: undefined,
      });
    });
  });

  describe("toString", () => {
    it("Should show model name and PK value if exists", () => {
      expect(new MockedModel({}).toString()).toBe("MockedModel ");
      expect(new MockedModelWithPK({ id: 1 }).toString()).toBe(
        "MockedModelWithPKDifferent (1)"
      );
    });
  });

  describe("set", () => {
    it("Should throw an error if the field does not exist on model.", () => {
      expect(() => new MockedModel({}).set({ some: 1 })).toThrow(
        new Error("Field some does not exist on MockedModel")
      );
    });

    it("Should set the value on the instance", () => {
      const instance = new MockedModel({});
      instance.set({ name: 1 });
      expect(instance.data.name).toBe(1);
      instance.set({ name: "2" });
      expect(instance.data.name).toBe("2");
    });

    it("Should call every fields setValue specified by key in the passed object", () => {
      const someField = new MockedField({});
      const idField = new MockedField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      const setValueSomeFieldMock = jest.spyOn(someField, "setValue");
      const setValueIdFieldMock = jest.spyOn(idField, "setValue");

      const modelInstance = new MockedModelWithMockField({});
      modelInstance.set({ some: 1 });
      expect(setValueSomeFieldMock).toHaveBeenNthCalledWith(1, {
        name: "some",
        fieldName: "some",
        modelInstance,
        value: 1,
      });
      expect(setValueIdFieldMock).not.toHaveBeenCalled();

      modelInstance.set({ some: "some", id: 2 });
      expect(setValueSomeFieldMock).toHaveBeenNthCalledWith(2, {
        name: "some",
        fieldName: "some",
        modelInstance,
        value: "some",
      });
      expect(setValueIdFieldMock).toHaveBeenNthCalledWith(1, {
        name: "id",
        fieldName: "id",
        modelInstance,
        value: 2,
      });
    });

    it("Should call setValue on a field if it is watching", () => {
      const someField = new MockedField({});
      const idField = new IntegerField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      const setValueSomeFieldMock = jest.spyOn(someField, "setValue");
      const setValueIdFieldMock = jest.spyOn(idField, "setValue");

      const modelInstance = new MockedModelWithMockField({});
      modelInstance.set({ somethingElse: 1 });
      expect(setValueSomeFieldMock).toHaveBeenNthCalledWith(1, {
        name: "some",
        fieldName: "somethingElse",
        modelInstance,
        value: 1,
      });
      expect(setValueIdFieldMock).not.toHaveBeenCalled();
    });

    it("should set data on instance as returned by fields setValue", () => {
      const someField = new MockedField({});
      const idField = new IntegerField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      jest.spyOn(someField, "setValue").mockImplementation(() => ({ o: 100 }));
      jest.spyOn(idField, "setValue").mockImplementation(() => ({ some: 100 }));

      const modelInstance = new MockedModelWithMockField({});
      modelInstance.set({ somethingElse: 1 });
      expect(modelInstance.data).toStrictEqual({
        o: 100,
      });
      modelInstance.set({ id: 1 });
      expect(modelInstance.data).toStrictEqual({
        o: 100,
        some: 100,
      });
      modelInstance.set({ somethingElse: 1 });
      expect(modelInstance.data).toStrictEqual({
        o: 100,
        some: 100,
      });
    });
  });

  describe("fromIOObject", () => {
    it("Return an instance with data set on it", () => {
      expect(MockedModel.fromIOObject({ name: 1, id: 0 })).toStrictEqual(
        new MockedModel({ name: "1", id: 0 }, true)
      );

      const someField = new MockedField({});
      const idField = new IntegerField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      jest
        .spyOn(someField, "fromIOObject")
        .mockImplementation(
          () => ({ some: "something", somethingElse: "1" } as any)
        );
      jest
        .spyOn(idField, "fromIOObject")
        .mockImplementation(() => ({ id: 2000 } as any));
      const instance = MockedModelWithMockField.fromIOObject({});
      expect(instance.data).toStrictEqual({
        id: 2000,
        some: "something",
        somethingElse: "1",
      });
    });

    it("If a field emits wrong name, should catch the error", () => {
      const someField = new MockedField({});
      const idField = new IntegerField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      jest
        .spyOn(someField, "fromIOObject")
        .mockImplementation(() => ({ moo: 1 } as any));
      jest
        .spyOn(idField, "fromIOObject")
        .mockImplementation(() => ({ moo1: 2000 } as any));
      try {
        MockedModelWithMockField.fromIOObject({});
      } catch (e: any) {
        const errors = {
          id: "fromIOObject on field might have returned incorrect field names or there is a bug in the class definition. If this is #Library provided Field class, Please report this so we can fix it asap. Could not set data on the instance. Error: Field moo1 does not exist on MockedModelWithMockField",
          some: "fromIOObject on field might have returned incorrect field names or there is a bug in the class definition. If this is #Library provided Field class, Please report this so we can fix it asap. Could not set data on the instance. Error: Field moo does not exist on MockedModelWithMockField",
        };
        expect(e).toStrictEqual(
          new ModelParsingError(
            "Failed to create model instance from external data.",
            errors
          )
        );
        expect(e.errors).toStrictEqual(errors);
      }
    });

    it("If a field emits anything other than object (non-array), it should throw an error", () => {
        const someField = new MockedField({});
        const idField = new IntegerField({});
        MockedModelWithMockField.prototype.fields = () =>
          ({
            some: someField,
            id: idField,
          } as any);
  
        jest
          .spyOn(someField, "fromIOObject")
          .mockImplementation(() => (1 as any));
        jest
          .spyOn(idField, "fromIOObject")
          .mockImplementation(() => ([] as any));
        try {
          MockedModelWithMockField.fromIOObject({});
        } catch (e: any) {
          const errors = {
            id: "Cannot initialize the model with IO data. fromIOObject on field returned an invalid object. Field should only emit a spreadable non array object with model values. Something you can pass to Model.set({...}).",
            some: "Cannot initialize the model with IO data. fromIOObject on field returned an invalid object. Field should only emit a spreadable non array object with model values. Something you can pass to Model.set({...}).",
          };
          expect(e).toStrictEqual(
            new ModelParsingError(
              "Failed to create model instance from external data.",
              errors
            )
          );
          expect(e.errors).toStrictEqual(errors);
        }
      });
    it("if errors occurred, should show errors of all fields", () => {
      const someField = new MockedField({});
      const idField = new IntegerField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      jest.spyOn(someField, "fromIOObject").mockImplementation(() => {
        throw new Error("Error Some");
      });
      jest.spyOn(idField, "fromIOObject").mockImplementation(() => {
        throw new Error("Error ID");
      });
      try {
        MockedModelWithMockField.fromIOObject({});
      } catch (e: any) {
        const errors = {
          id: "Error ID",
          some: "Error Some",
        };
        expect(e).toStrictEqual(
          new ModelParsingError(
            "Failed to create model instance from external data.",
            errors
          )
        );
        expect(e.errors).toStrictEqual(errors);
      }

      jest.spyOn(idField, "fromIOObject").mockImplementation(() => ({} as any));
      try {
        MockedModelWithMockField.fromIOObject({ id: 10 });
      } catch (e: any) {
        const errors = {
          some: "Error Some",
        };
        expect(e).toStrictEqual(
          new ModelParsingError(
            "Failed to create model instance from external data.",
            errors
          )
        );
        expect(e.errors).toStrictEqual(errors);
      }
    });
    it('Should not call fields with extra names. Only call fields with names specified in the fields() method', () => {


        const someField = new MockedField({});
      const idField = new IntegerField({});
      MockedModelWithMockField.prototype.fields = () =>
        ({
          some: someField,
          id: idField,
        } as any);

      const fromIOObjectSome = jest.spyOn(someField, "fromIOObject").mockReturnValue({some: 10})
      const fromIOObjectId = jest.spyOn(idField, "fromIOObject").mockReturnValue({id: 10})
      const ioObject = {id:  1000, some: 'somethingBetter'}
      MockedModelWithMockField.fromIOObject(ioObject)
      
      expect(fromIOObjectId).toHaveBeenCalledTimes(1)
      expect(fromIOObjectId).toHaveBeenCalledWith({
        name: 'id',
        ioObject,
        modelInstance: new MockedModelWithMockField({id: 10, some: 10}, true)
      })
      expect(fromIOObjectSome).toHaveBeenCalledTimes(1)
      expect(fromIOObjectSome).toHaveBeenCalledWith({
        name: 'some',
        ioObject,
        modelInstance: new MockedModelWithMockField({id: 10, some: 10}, true)
      })

    })
  });
});
