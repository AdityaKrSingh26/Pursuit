import { describe, expect, it } from 'vitest'
import { resumePdfState } from '../modules/resume/resumePdf.js'

describe('resumePdfState', () => {
  it('reports failed when renderStatus is FAILED', () => {
    expect(resumePdfState({
      renderStatus: 'FAILED',
      renderError: 'Cloudinary not configured',
      pdfKey: null,
    })).toEqual({
      kind: 'failed',
      error: 'Cloudinary not configured',
    })
  })

  it('reports rendering while pending or missing pdfKey', () => {
    expect(resumePdfState({ renderStatus: 'PENDING', pdfKey: null })).toEqual({ kind: 'rendering' })
    expect(resumePdfState({ renderStatus: 'DONE', pdfKey: null })).toEqual({ kind: 'rendering' })
  })

  it('reports ready with pdfKey when DONE', () => {
    expect(resumePdfState({
      renderStatus: 'DONE',
      pdfKey: 'resumes/u/v.pdf',
    })).toEqual({ kind: 'ready', pdfKey: 'resumes/u/v.pdf' })
  })
})
