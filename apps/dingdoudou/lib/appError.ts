export type AppErrorCode =
  | 'account.bindLimit'
  | 'account.credentialMissing'
  | 'account.invalidCredential'
  | 'account.notBound'
  | 'account.removedDuringSync'
  | 'account.required'
  | 'backend.credentialsRequired'
  | 'backend.requestFailed'
  | 'backend.timeout'
  | 'backend.urlCredentials'
  | 'backend.urlInvalid'
  | 'backend.urlProtocol'
  | 'license.featureUnavailable'
  | 'license.inactive'
  | 'license.memberInactive'
  | 'license.superCodeInvalid'
  | 'message.unknown'
  | 'order.selectionRequired'
  | 'pdd.loginRequired'
  | 'pdd.requestFailed'
  | 'pdd.sessionCookieFailed';

export type AppErrorDetails = Record<string, string | number>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: AppErrorDetails;

  constructor(code: AppErrorCode, details?: AppErrorDetails) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
