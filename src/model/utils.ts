// import { getCurrentIOConnector } from "../connector";

import type { DataIOConnector } from "../connector";

export enum MODEL_ACTIONS {
    CREATE,
    UPDATE,
    DELETE,
    RETRIEVE,
    LIST,
  }


  export const getIOConnector = () => {
    return {} as DataIOConnector;
  };