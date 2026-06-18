export function computeMatchScore(matched, missing, partial, llmScore) {
  const overlap = matched.length / Math.max(1, matched.length + missing.length + 0.5 * partial.length)
  const matchScore = Math.round(0.6 * overlap * 100 + 0.4 * llmScore)
  return {
    matchScore,
    skillOverlapPct: Math.round(overlap * 100),
    llmRelevanceScore: llmScore,
  }
}
