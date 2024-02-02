import { Model } from "../Model";

export const getModelFieldValue = (model: Model, fieldName: string) => {
  return model.data[fieldName];
};

export const isDateValid = (date: any) => {
  if (
    date instanceof Date &&
    Number.isFinite(date.getDate()) &&
    Number.isFinite(date.getMonth()) &&
    Number.isFinite(date.getFullYear())
  ) {
    return true
  }
  return false
};
