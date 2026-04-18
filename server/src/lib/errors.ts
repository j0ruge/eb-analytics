export class HttpError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function httpError(code: string, message: string, statusCode: number): HttpError {
  return new HttpError(code, message, statusCode);
}
