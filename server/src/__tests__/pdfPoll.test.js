import { describe, expect, it } from 'vitest'
import { PDF_POLL_TIMEOUT_MS, decidePdfPoll } from '../../../client/src/lib/pdfPoll.ts'

describe('decidePdfPoll', () => {
  it('is ready when the API returns a url', () => {
    expect(decidePdfPoll({ url: 'https://signed.example/file' }, 1000)).toBe('ready')
  })

  it('is failed when the API reports failed or the request is an error', () => {
    expect(decidePdfPoll({ status: 'failed', error: 'Cloudinary not configured' }, 1000)).toBe('failed')
    expect(decidePdfPoll({ error: true }, 1000)).toBe('failed')
  })

  it('times out after 30 seconds', () => {
    expect(decidePdfPoll({ status: 'rendering' }, PDF_POLL_TIMEOUT_MS)).toBe('timeout')
    expect(decidePdfPoll({ status: 'rendering' }, PDF_POLL_TIMEOUT_MS - 1)).toBe('continue')
  })
})
