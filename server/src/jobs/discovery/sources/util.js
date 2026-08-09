export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Runs `fn` over `items` in batches of `size`, pausing `delayMs` between batches.
export async function runInBatches(items, size, delayMs, fn) {
  const results = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
    if (i + size < items.length && delayMs > 0) await sleep(delayMs)
  }
  return results
}
