import { Field } from "../Field";
import { MODEL_ACTIONS } from "../../utils";
import { ModelFieldValidationError } from "../ModelFieldValidationError";
import { FloatField, IntegerField, NUMBER_FIELD_ERRORS } from "../NumberFields";
import { Model } from "../../Model";

class MockedModel extends Model {
  getName(): string {
    return "MockedModel";
  }
  fields() {
    return {
      some: new Field({}),
    };
  }
}
describe("IntegerField", () => {
  describe("constructor", () => {
    it("Should set the min max correctly", () => {
      expect(new IntegerField({ min: 10 }).min).toBe(10);
      expect(new IntegerField({ max: 10 }).max).toBe(10);
    });

    it("throws if min or max are not valid numbers", () => {
      expect(() => new IntegerField({ min: "10" as any })).toThrow(
        new Error(NUMBER_FIELD_ERRORS.INVALID_MIN)
      );
      expect(() => new IntegerField({ max: "10" as any })).toThrow(
        new Error(NUMBER_FIELD_ERRORS.INVALID_MAX)
      );
    });
  });

  describe("validate", () => {
    it("Should inherit Field validation behavior", () => {
      expect(() =>
        new IntegerField({}).validate({
          name: "some",
          fieldName: "some",
          value: undefined,
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(ModelFieldValidationError);
    });

    it("Should assert minimum value if provided.", () => {
      expect(() =>
        new IntegerField({ min: 10 }).validate({
          name: "some",
          fieldName: "some",
          value: 9,
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(
        new ModelFieldValidationError("Should be greater than 10.", "some")
      );
    });
    it("Should assert maximum value if provided.", () => {
      expect(() =>
        new IntegerField({ max: 10 }).validate({
          name: "some",
          fieldName: "some",
          value: 11,
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(
        new ModelFieldValidationError("Should be less than 10.", "some")
      );
    });

    it("Should throw if the number is not valid", () => {
      expect(() =>
        new IntegerField({}).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: "a",
        })
      ).toThrow(
        "Invalid number value. Should be a valid number or parsable number string."
      );

      expect(
        new IntegerField({}).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: "1",
        })
      ).toStrictEqual(1);
    });
  });

  describe("parseValue", () => {
    it("Should parse any parsable value to integer.", () => {
      expect(new IntegerField({}).parseValue("12")).toBe(12);
      expect(new IntegerField({}).parseValue(12.1)).toBe(12);
    });

    it("Should return null if value is not set", () => {
      expect(new IntegerField({}).parseValue(undefined)).toBe(null);
      expect(new IntegerField({}).parseValue(null)).toBe(null);
    });
  });
});

describe("FloatField", () => {
  describe("constructor", () => {
    it("Should set the min max correctly", () => {
      expect(new FloatField({ min: 10.1 }).min).toBe(10.1);
      expect(new FloatField({ max: 10.1 }).max).toBe(10.1);
    });

    it("throws if min or max are not valid numbers", () => {
      expect(() => new FloatField({ min: "10" as any })).toThrow(
        new Error(NUMBER_FIELD_ERRORS.INVALID_MIN)
      );
      expect(() => new FloatField({ max: "10" as any })).toThrow(
        new Error(NUMBER_FIELD_ERRORS.INVALID_MAX)
      );
    });
  });

  describe("validate", () => {
    it("Should inherit Field validation behavior", () => {
      expect(() =>
        new FloatField({}).validate({
          name: "some",
          fieldName: "some",
          value: undefined,
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(ModelFieldValidationError);
    });

    it("Should assert minimum value if provided.", () => {
      expect(() =>
        new FloatField({ min: 10.5 }).validate({
          name: "some",
          fieldName: "some",
          value: 10.4,
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(
        new ModelFieldValidationError("Should be greater than 10.5.", "some")
      );
    });
    it("Should assert maximum value if provided.", () => {
      expect(() =>
        new FloatField({ max: 10.5 }).validate({
          name: "some",
          fieldName: "some",
          value: 10.6,
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(
        new ModelFieldValidationError("Should be less than 10.5.", "some")
      );
    });

    it("Should assert that the number is valid", () => {
      expect(() =>
        new FloatField({ max: 10.5 }).validate({
          name: "some",
          fieldName: "some",
          value: "a",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
        })
      ).toThrow(
        new ModelFieldValidationError(
          "Invalid number value. Should be a valid number or parsable number string.",
          "some"
        )
      );
    });
  });

  describe("parseValue", () => {
    it("Should parse any parsable value to integer.", () => {
      expect(new FloatField({}).parseValue("12")).toBe(12.0);
      expect(new FloatField({}).parseValue(12.1)).toBe(12.1);
    });

    it("Should return null if value is not set", () => {
      expect(new FloatField({}).parseValue(undefined)).toBe(null);
      expect(new FloatField({}).parseValue(null)).toBe(null);
    });
  });
});
