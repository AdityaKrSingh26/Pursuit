import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../lib/env.js')
  vi.doUnmock('cloudinary')
})

describe('storage', () => {
  it('uploadBuffer throws when Cloudinary is not configured', async () => {
    vi.resetModules()
    vi.doMock('../lib/env.js', () => ({
      env: {
        CLOUDINARY_CLOUD_NAME: undefined,
        CLOUDINARY_API_KEY: undefined,
        CLOUDINARY_API_SECRET: undefined,
      },
    }))
    vi.doMock('cloudinary', () => ({
      v2: { config: vi.fn(), url: vi.fn(), uploader: {}, utils: {} },
    }))
    const { uploadBuffer } = await import('../lib/storage.js')
    await expect(uploadBuffer('resumes/u/v.pdf', Buffer.from('%PDF'), 'application/pdf'))
      .rejects.toThrow(/not configured/i)
  })

  it('getSignedUrl signs the delivery URL and honors expirySeconds', async () => {
    const url = vi.fn((_key, opts) => `https://res.cloudinary.com/demo/signed/${opts.expires_at}`)
    vi.resetModules()
    vi.doMock('../lib/env.js', () => ({
      env: {
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      },
    }))
    vi.doMock('cloudinary', () => ({
      v2: {
        config: vi.fn(),
        url,
        uploader: {},
        utils: {},
      },
    }))
    const { getSignedUrl } = await import('../lib/storage.js')
    const before = Math.floor(Date.now() / 1000)
    const result = await getSignedUrl('resumes/u/v.pdf', 300)
    const after = Math.floor(Date.now() / 1000)
    expect(url).toHaveBeenCalledWith('resumes/u/v.pdf', expect.objectContaining({
      sign_url: true,
      expires_at: expect.any(Number),
    }))
    const expiresAt = url.mock.calls[0][1].expires_at
    expect(expiresAt).toBeGreaterThanOrEqual(before + 300)
    expect(expiresAt).toBeLessThanOrEqual(after + 300)
    expect(result).toContain('signed')
  })
})
