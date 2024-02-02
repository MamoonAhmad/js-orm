import { getCurrentIOConnector } from "../connector";

export enum MODEL_ACTIONS {
    CREATE,
    UPDATE,
    DELETE,
    RETRIEVE,
    LIST,
  }


  export const getIOConnector = () => {
    return getCurrentIOConnector();
  };