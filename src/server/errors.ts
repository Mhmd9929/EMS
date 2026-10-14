/** Domain errors thrown by services and mapped to user-facing results by `runAction`. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message);
  }
}
export class ValidationError extends AppError {}
export class ConflictError extends AppError {}
