import { Model } from "../model/Model";
import { RESTAPINetworkConnector } from "./RESTAPINetworkConnector";

export type IOObject = Record<string, any>;

export type DataIOConnectorCreateProps = {
  object: Record<string, any>;
  ModelClass: typeof Model;
};

export type DataIOConnectorUpdateProps = {
  modelData: Record<string, any>;
  filters: Record<string, any>;
  ModelClass: typeof Model;
};

export type DataIOConnectorDeleteProps = {
  filters: Record<string, any>;
  ModelClass: typeof Model;
};

export type DataIOConnectorRetrieveProps = {
  idValue: any;
  ModelClass: typeof Model;
};

export type DataIOConnectorListProps = {
  filters?: Record<string, any>;
  ModelClass: typeof Model;
};

export type ResponseObject = Record<string, any>

export interface DataIOConnector {
  create(props: DataIOConnectorCreateProps): Promise<ResponseObject>;
  update(props: DataIOConnectorUpdateProps): Promise<Model[]>;
  delete(props: DataIOConnectorDeleteProps): Promise<void>;
  retrieve(props: DataIOConnectorRetrieveProps): Promise<ResponseObject>;
  list(props: DataIOConnectorListProps): Promise<ResponseObject>;

  updateObject<T extends typeof Model = any>(props: {
    object: { emittedData: Record<string, any>; idValue: any };
    ModelClass: T;
  }): Promise<Record<string, any>>;

  updateObjects<T extends typeof Model = any>(props: {
    objects: { emittedData: Record<string, any>; idValue: any }[];
    ModelClass: T;
  }): Promise<Record<string, any>[]>;

  createObjects<T extends typeof Model = any>(props: {
    objects: Record<string, any>[];
    ModelClass: T;
  }): Promise<Record<string, any>[]>;

  deleteObjects<T extends typeof Model = any>(props: {
    objectIDs: any[];
    ModelClass: T;
  }): Promise<void>;

  deleteObject<T extends typeof Model = any>(props: {
    objectID: any;
    ModelClass: T;
  }): Promise<void>;
}

export const getCurrentIOConnector = (): DataIOConnector => {
  return new RESTAPINetworkConnector() as any;
};
