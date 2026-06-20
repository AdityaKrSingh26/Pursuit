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
    req.query = parsed.data
    next()
  }
}
