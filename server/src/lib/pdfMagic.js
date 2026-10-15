export function isPdfBuffer(buf) {
  if (!buf || buf.length < 4) return false
  return buf.subarray(0, 4).toString('latin1') === '%PDF'
}
