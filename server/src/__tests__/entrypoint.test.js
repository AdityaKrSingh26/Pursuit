import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'url'
import { isEntrypoint } from '../lib/entrypoint.js'

describe('isEntrypoint', () => {
  it('is true when argv[1] is this module', () => {
    const file = 'D:\\Projects\\Pursuit\\server\\src\\index.js'
    expect(isEntrypoint(pathToFileURL(file).href, file)).toBe(true)
  })

  it('is false when vitest (or another file) is the process entry', () => {
    const moduleUrl = pathToFileURL('D:\\Projects\\Pursuit\\server\\src\\index.js').href
    expect(isEntrypoint(moduleUrl, 'D:\\Projects\\Pursuit\\server\\node_modules\\vitest\\vitest.mjs')).toBe(false)
    expect(isEntrypoint(moduleUrl, undefined)).toBe(false)
  })
})
