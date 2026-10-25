// Shared error types. The REST layer maps these to HTTP codes; the AI layer
// turns ForbiddenError into a polite refusal instead of leaking data.

export class ForbiddenError extends Error {
  constructor(message = 'You are not allowed to access this information.') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found.') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export class ValidationError extends Error {
  constructor(message = 'Invalid input.') {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}
