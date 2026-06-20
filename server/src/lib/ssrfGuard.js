import dns from 'dns/promises'
import ipaddr from 'ipaddr.js'
import { AppError } from './errors.js'

const BLOCKED_RANGES = [
  '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12',
  '192.168.0.0/16', '169.254.0.0/16', '::1/128',
  'fc00::/7', 'fe80::/10',
]

export class SsrfError extends AppError {
  constructor(msg) {
    super(msg, 400, 'SSRF_ERROR')
    this.name = 'SsrfError'
  }
}

export async function assertSafeUrl(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SsrfError('Invalid URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new SsrfError('Only http/https allowed')
  }

  const { address } = await dns.lookup(url.hostname)
  const parsed = ipaddr.parse(address)
  for (const range of BLOCKED_RANGES) {
    try {
      if (parsed.match(ipaddr.parseCIDR(range))) {
        throw new SsrfError(`Blocked IP range: ${range}`)
      }
    } catch (e) {
      if (e instanceof SsrfError) throw e
      // CIDR parse mismatch for wrong IP family, skip
    }
  }
}
