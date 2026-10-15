import crypto from 'crypto'

export function hashResumeBlocks(blocks) {
  const canonical = [...(blocks ?? [])]
    .map((b) => ({
      id: b.id ?? b.blockId ?? '',
      section: b.section ?? '',
      content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? ''),
      skillTags: [...(b.skillTags ?? [])].sort(),
      orderDefault: b.orderDefault ?? 0,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
