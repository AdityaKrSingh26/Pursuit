import { describe, expect, it } from 'vitest'
import { buildApprovedBlocks } from '../../../client/src/lib/approvedBlocks.ts'

describe('buildApprovedBlocks', () => {
  const proposals = [
    { blockId: 'b1' },
    { blockId: 'b2' },
    { blockId: 'b3' },
  ]
  const blocks = [
    { id: 'b1', section: 'EXPERIENCE', skillTags: ['Go'] },
    { id: 'b2', section: 'SKILLS', skillTags: ['SQL'] },
    { id: 'b3', section: 'PROJECTS', skillTags: [] },
  ]

  it('keeps included blocks with section and skillTags so the PDF can group headings', () => {
    const decisions = {
      b1: { include: true, content: 'Shipped it' },
      b2: { include: false, content: '' },
      b3: { include: true, content: 'Side project' },
    }

    expect(buildApprovedBlocks(proposals, decisions, blocks)).toEqual([
      { blockId: 'b1', content: 'Shipped it', section: 'EXPERIENCE', skillTags: ['Go'] },
      { blockId: 'b3', content: 'Side project', section: 'PROJECTS', skillTags: [] },
    ])
  })
})
