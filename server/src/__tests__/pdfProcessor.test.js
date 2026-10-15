import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db.js', () => ({
  prisma: {
    resumeVersion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('../lib/storage.js', () => ({
  uploadBuffer: vi.fn(),
}))

vi.mock('../jobs/pdf/pdfRenderer.js', () => ({
  renderResumePdf: vi.fn(),
  renderResumePdfFallback: vi.fn(),
}))

import { prisma } from '../lib/db.js'
import { uploadBuffer } from '../lib/storage.js'
import { renderResumePdf } from '../jobs/pdf/pdfRenderer.js'
import { pdfProcessor } from '../jobs/pdf/pdfProcessor.js'

const VERSION_ID = 'ver-1'
const USER_ID = 'user-1'
const job = { data: { resumeVersionId: VERSION_ID, userId: USER_ID } }

describe('pdfProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.resumeVersion.findUnique.mockResolvedValue({
      id: VERSION_ID,
      blocksSnapshot: [{ section: 'SKILLS', content: 'Go' }],
    })
    prisma.user.findUnique.mockResolvedValue({ email: 'dev@example.com' })
    prisma.resumeVersion.update.mockResolvedValue({})
    renderResumePdf.mockResolvedValue(Buffer.from('%PDF-fake'))
  })

  it('sets renderStatus FAILED and does not write pdfKey when Cloudinary is missing', async () => {
    uploadBuffer.mockRejectedValue(new Error('Cloudinary not configured'))

    await expect(pdfProcessor(job)).rejects.toThrow(/not configured/i)

    expect(prisma.resumeVersion.update).toHaveBeenCalledWith({
      where: { id: VERSION_ID },
      data: expect.objectContaining({
        renderStatus: 'FAILED',
        renderError: expect.stringMatching(/not configured/i),
      }),
    })
    const data = prisma.resumeVersion.update.mock.calls[0][0].data
    expect(data.pdfKey).toBeUndefined()
  })

  it('sets renderStatus DONE and pdfKey when upload succeeds', async () => {
    uploadBuffer.mockResolvedValue({ public_id: 'ok' })

    await pdfProcessor(job)

    expect(prisma.resumeVersion.update).toHaveBeenCalledWith({
      where: { id: VERSION_ID },
      data: {
        pdfKey: `resumes/${USER_ID}/${VERSION_ID}.pdf`,
        renderStatus: 'DONE',
        renderError: null,
      },
    })
  })
})
