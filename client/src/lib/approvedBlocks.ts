export function buildApprovedBlocks(
  proposals: Array<{ blockId: string }>,
  decisions: Record<string, { include: boolean; content: string }>,
  blocks: Array<{ id: string; section: string; skillTags: string[] }>,
) {
  const byId = new Map(blocks.map((b) => [b.id, b]))
  return proposals
    .filter((p) => decisions[p.blockId]?.include)
    .map((p) => {
      const block = byId.get(p.blockId)
      return {
        blockId: p.blockId,
        content: decisions[p.blockId].content,
        section: block?.section ?? 'OTHER',
        skillTags: block?.skillTags ?? [],
      }
    })
}
