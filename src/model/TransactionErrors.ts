import {
  ModelDataEmitError,
  ModelParsingError,
  ModelValidationError,
} from "./ModelErrors";

export type ResponseDataProcessingErrorMetaData = {
  responseObject: any;
  errorObject?: any;
  error?: ModelParsingError;
};
export class ResponseDataProcessingError extends Error {
  constructor(
    message: string,
    public metaData?: ResponseDataProcessingErrorMetaData
  ) {
    super(message);
  }
}

type DataValidationErrorMetaData = {
  errorObject?: any;
  error?: ModelValidationError;
};
export class DataValidationError extends Error {
  constructor(message: string, public metaData: DataValidationErrorMetaData) {
    super(message);
  }
}

export type DataEmissionErrorMetaData = {
  errorObject?: any;
  error?: ModelDataEmitError;
};
export class DataEmissionError extends Error {
  constructor(message: string, public metaData: DataEmissionErrorMetaData) {
    super(message);
  }
}

export type DataOutputErrorMetaData = {
  errorObject?: any;
  error?: ModelParsingError;
};
export class DataOutputError extends Error {
  constructor(message: string, public metaData?: DataOutputErrorMetaData) {
    super(message);
  }
}

export class TransportError extends Error {
  constructor(
    message: string,
    public metaData?: {
      error?: Error;
      status?: string;
      url: string;
      request: {
        requestBody: any;
        requestHeaders: any;
        requestMethod: any;
      };
      response?: any;
    }
  ) {
    super(message);
  }
}
