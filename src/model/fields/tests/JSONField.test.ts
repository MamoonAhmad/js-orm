import { Model } from "../../Model";
import { MODEL_ACTIONS } from "../../utils";
import { JSONField } from "../JSONField";
import { IntegerField } from "../NumberFields";

class MockedModel extends Model {
  getName(): string {
    return "MockedModel";
  }
  fields() {
    return { id: new IntegerField({}) };
  }
}
class Some {}
describe("JSONField", () => {
  describe("constructor", () => {
    it("validates schema. Every key in schema object should be an instance of Field class", () => {
      expect(
        () => new JSONField({ schema: { some: new Some() as any } })
      ).toThrow(
        'Invalid "some" in the schema. Every key in schema must be an instance of Field class.'
      );

      expect(() => new JSONField({ schema: 1 as any })).toThrow(
        "Invalid schema object."
      );
    });

    it("Schema is optional", () => {
      expect(new JSONField({}));
    });
  });

  describe("validate", () => {
    it("Should validate the schema if passed", () => {
      let field = new JSONField({
        schema: {
          some: new IntegerField({ nullable: true }),
          some1: new IntegerField({ nullable: false }),
        },
      });

      expect(() =>
        field.validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: {},
        })
      ).toThrow("some1: This field is not nullable.");

      field = new JSONField({
        schema: {
          some: new IntegerField({ nullable: true }),
          some1: new IntegerField({ nullable: false }),
          some2: new IntegerField({ nullable: false, min: 200 }),
        },
      });
      expect(() =>
        field.validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: { some1: 1 },
        })
      ).toThrow("some2: This field is not nullable.");

      expect(() =>
        field.validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: { some1: 1, some2: 10 },
        })
      ).toThrow("some2: Should be greater than 200.");
    });

    it("Should validate object if the schema is not present", () => {
      expect(() =>
        new JSONField({}).validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: undefined,
        })
      ).toThrow("This field is not nullable.");

      expect(
        new JSONField({}).validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: { some: 1 },
        })
      ).toStrictEqual({ some: 1 });
    });

    it("Should strip extra fields from object if schema is present", () => {
      const field = new JSONField({
        schema: {
          some: new IntegerField({ nullable: true }),
          some1: new IntegerField({ nullable: false }),
        },
      });

      expect(
        field.validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: { some: 1, some1: 2, some2: 10 },
        })
      ).toStrictEqual({
        some: 1,
        some1: 2,
      });
    });

    it("Should emit object with null values if values are not present in passed object", () => {
      const field = new JSONField({
        schema: {
          some: new IntegerField({ nullable: true }),
          some1: new IntegerField({ nullable: true }),
        },
      });

      expect(
        field.validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: {},
        })
      ).toStrictEqual({
        some: null,
        some1: null,
      });
    });
  });
});
