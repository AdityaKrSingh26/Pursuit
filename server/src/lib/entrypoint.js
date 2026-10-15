import { resolve } from 'path'
import { fileURLToPath } from 'url'

export function isEntrypoint(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false
  try {
    return resolve(fileURLToPath(metaUrl)) === resolve(argv1)
  } catch {
    return false
  }
}
