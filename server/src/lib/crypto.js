import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

const BCRYPT_ROUNDS = 12

export function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function generateToken() {
  return randomBytes(32).toString('hex')
}

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex')
}
