import { Model } from "../../Model";
import { MODEL_ACTIONS } from "../../utils";
import { DateTimeField } from "../DateTimeField";
import { IntegerField } from "../NumberFields";

class MockedModel extends Model {
  getName(): string {
      return 'MockedModel'
  }
  fields() {
    return { id: new IntegerField({}) };
  }
}

describe("DateTimeField", () => {
  describe("constructor", () => {
    it("Should validate the min date", () => {
      expect(() => new DateTimeField({ min: NaN as any })).toThrow(
        "min: Invalid date object"
      );
    });

    it("Should validate the max date", () => {
      expect(() => new DateTimeField({ max: NaN as any })).toThrow(
        "max: Invalid date object"
      );
    });

    it("Min date should not be after max date.", () => {
      expect(
        () =>
          new DateTimeField({ max: new Date("12-12-2023"), min: new Date() })
      ).toThrow("min: Min date should not be after max date.");
    });

    it("should set config correctly", () => {
      const date1 = new Date();
      expect(new DateTimeField({ min: date1 }).min).toBe(date1);
      const date2 = new Date();
      expect(new DateTimeField({ max: date2 }).max).toBe(date2);
      const field = new DateTimeField({ min: date1, max: date2 });
      expect(field.max).toBe(date2);
      expect(field.min).toBe(date1);
    });
  });

  describe("validate", () => {
    it("Should validate the min date", () => {
      const minDate = new Date("12-12-2023");
      expect(() =>
        new DateTimeField({ min: minDate }).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: new Date("12-10-2023"),
        })
      ).toThrow(`Date should be after or equal to ${minDate.toString()}`);
    });

    it("Should validate the max date", () => {
      const maxDate = new Date("12-12-2023");
      expect(() =>
        new DateTimeField({ max: maxDate }).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: new Date(),
        })
      ).toThrow(`Date should be before or equal to ${maxDate.toString()}`);

      expect(() =>
        new DateTimeField({ max: maxDate }).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: new Date(),
        })
      ).toThrow(`Date should be before or equal to ${maxDate.toString()}`);
    });

    it("Should work when both min and max are set", () => {
      expect(() =>
        new DateTimeField({
          max: new Date(),
          min: new Date("12-12-2023"),
        }).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: new Date("1-1-2022"),
        })
      ).toThrow(
        `Date should be after or equal to ${new Date("12-12-2023").toString()}`
      );

      expect(() =>
        new DateTimeField({
          max: new Date("1-12-2024"),
          min: new Date("12-12-2023"),
        }).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: new Date("1-1-2025"),
        })
      ).toThrow(
        `Date should be before or equal to ${new Date("1-12-2024").toString()}`
      );
    });

    it("should work when min and max are not set", () => {
      expect(
        new DateTimeField({}).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: "12-12-2023",
        })
      ).toStrictEqual(new Date("12-12-2023"));
      expect(
        new DateTimeField({}).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: 1,
        })
      ).toStrictEqual(new Date(1));

      expect(
        new DateTimeField({ nullable: true }).validate({
          name: "c",
          fieldName: "c",
          modelAction: MODEL_ACTIONS.CREATE,
          modelInstance: new MockedModel({}),
          value: null,
        })
      ).toBe(null);
    });
  });

  describe("parseValue", () => {
    it("Should parse value to date", () => {
      expect(new DateTimeField({}).parseValue("12-12-2023")).toStrictEqual(
        new Date("12-12-2023")
      );
      expect(new DateTimeField({}).parseValue(1)).toStrictEqual(new Date(1));
      const d = new Date();
      expect(new DateTimeField({}).parseValue(d)).toStrictEqual(new Date(d));
      expect(new DateTimeField({}).parseValue(null)).toStrictEqual(null);
      expect(new DateTimeField({}).parseValue(undefined)).toStrictEqual(null);
    });
  });
});
