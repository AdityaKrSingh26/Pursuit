export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }

  static badRequest(message) {
    return new AppError(message, 400, 'BAD_REQUEST')
  }

  static unauthorized(message = 'Invalid or expired token') {
    return new AppError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403, 'FORBIDDEN')
  }

  static conflict(message) {
    return new AppError(message, 409, 'CONFLICT')
  }

  static notFound(message = 'Not found') {
    return new AppError(message, 404, 'NOT_FOUND')
  }
}
