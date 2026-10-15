export async function rotateAcrossKeys(
  keys,
  startIndex,
  fn,
  isRateLimited = (e) => e?.status === 429,
) {
  if (!keys.length) throw new Error('No API keys configured')
  let lastErr
  for (let i = 0; i < keys.length; i++) {
    const idx = (startIndex + i) % keys.length
    try {
      const result = await fn(keys[idx], idx)
      return { result, keyIndex: idx }
    } catch (e) {
      lastErr = e
      if (!isRateLimited(e)) throw e
    }
  }
  throw lastErr
}
