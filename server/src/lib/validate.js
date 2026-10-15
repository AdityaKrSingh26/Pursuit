import { AppError } from './errors.js'

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return next(AppError.badRequest(parsed.error.issues[0].message))
    }
    req.body = parsed.data
    next()
  }
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) {
      return next(AppError.badRequest(parsed.error.issues[0].message))
    }
    // Express 5 exposes req.query as a getter-only property.
    Object.defineProperty(req, 'query', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: parsed.data,
    })
    next()
  }
}
