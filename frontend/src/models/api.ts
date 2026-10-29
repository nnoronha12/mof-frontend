export interface ApiResponse<T> {
  success: boolean;
  responseTimeStamp: string;
  data: T;
  errors: Errors[];
  validationErrors: ApiValidationErrors[];
  successMessage?: string;
  validationInfo: string[];
}

export interface Errors {
  errorCode: number;
  errorMessage: string;
}

export interface ApiValidationErrors {
  fieldName: string;
  messages: string[];
} 