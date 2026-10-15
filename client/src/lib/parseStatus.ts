import type { ParseStatus } from './types'

export function shouldNotifyParseDone(status: ParseStatus | undefined): boolean {
  return status === 'DONE'
}
