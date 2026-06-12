import jwt from 'jsonwebtoken'
import { env } from './env.js'

export function signAccessToken(userId) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '15m' })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET)
}
