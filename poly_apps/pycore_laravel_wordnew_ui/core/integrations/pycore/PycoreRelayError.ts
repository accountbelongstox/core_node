export type PycoreRelayErrorKind = 'not-paired' | 'peer-offline' | 'device-offline' | 'rate-limited' | 'request-timeout' | 'too-large' | 'http';

export class PycoreRelayError extends Error {
  readonly kind: PycoreRelayErrorKind;
  readonly status: number;

  constructor(kind: PycoreRelayErrorKind, message: string, status = 0) {
    super(message);
    this.name = 'PycoreRelayError';
    this.kind = kind;
    this.status = status;
  }
}

export function isPycoreRelayError(error: unknown): error is PycoreRelayError {
  return !!error && (error as PycoreRelayError).name === 'PycoreRelayError';
}
