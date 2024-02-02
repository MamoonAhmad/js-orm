import { Model } from "../../Model";
import { MODEL_ACTIONS } from "../../utils";
import { IntegerField } from "../NumberFields";

import { TextField } from "../TextFields";

class MockedModel extends Model {
  getName(): string {
    return "MockedModel";
  }
  fields() {
    return {
      id: new IntegerField({}),
    };
  }
}

describe("TextField", () => {
  describe("constructor", () => {
    it("Should check the maxLength", () => {
      expect(() => new TextField({ maxLength: NaN })).toThrow(
        "maxLength should be a valid number"
      );
      expect(() => new TextField({ maxLength: "aa" as any })).toThrow(
        "maxLength should be a valid number"
      );

      expect(new TextField({ maxLength: "1" as any }).maxLength).toBe(1);
      expect(new TextField({ maxLength: 2.1 as any }).maxLength).toBe(2);
    });

    it("Should check the minLength", () => {
      expect(() => new TextField({ minLength: NaN })).toThrow(
        "minLength should be a valid number"
      );
      expect(() => new TextField({ minLength: "aa" as any })).toThrow(
        "minLength should be a valid number"
      );

      expect(new TextField({ minLength: "1" as any }).minLength).toBe(1);
      expect(new TextField({ minLength: 2.1 as any }).minLength).toBe(2);
    });
  });

  describe("validate", () => {
    it("Should validate minLength", () => {
      expect(() =>
        new TextField({ minLength: 10 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "some",
        })
      ).toThrow("Should contain minimum of 10 characters.");

      expect(
        new TextField({ minLength: 2 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "some",
        })
      ).toBe("some");
    });

    it("Should validate maxLength", () => {
      expect(() =>
        new TextField({ maxLength: 10 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "someSomeSome",
        })
      ).toThrow("Should contain maximum of 10 characters.");

      expect(
        new TextField({ maxLength: 2 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "1",
        })
      ).toBe("1");
    });

    it("should work with min and max length ", () => {
      expect(() =>
        new TextField({ maxLength: 10, minLength: 2 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "s",
        })
      ).toThrow("Should contain minimum of 2 characters.");

      expect(() =>
        new TextField({ maxLength: 10, minLength: 2 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "someSomeSome",
        })
      ).toThrow("Should contain maximum of 10 characters.");

      expect(
        new TextField({ maxLength: 10, minLength: 2 }).validate({
          fieldName: "c",
          name: "c",
          modelInstance: new MockedModel({}),
          modelAction: MODEL_ACTIONS.CREATE,
          value: "someSomeSo",
        })
      ).toBe("someSomeSo");
    });
    it("Should work with null", () => {
      expect(
        new TextField({ nullable: true }).validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: null,
        })
      ).toBe(null);

      expect(
        new TextField({ nullable: true }).validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: undefined,
        })
      ).toBe(null);

      expect(() =>
        new TextField({}).validate({
          fieldName: "c",
          name: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: null,
        })
      ).toThrow();
    });

    it("should return a parse value", () => {
      expect(
        new TextField({}).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: 1,
        })
      ).toBe("1");

      expect(
        new TextField({}).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: true,
        })
      ).toBe("true");
    });
  });

  describe("parseValue", () => {
    it("Should return a string always", () => {
      expect(new TextField({}).parseValue(1)).toBe("1");
      expect(new TextField({}).parseValue(null)).toBe(null);
      expect(new TextField({}).parseValue("a")).toBe("a");
    });
  });
});
