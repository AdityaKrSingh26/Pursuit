export function parseJsonFromLlm(text) {
  if (typeof text !== 'string') return null
  let s = text.trim()
  if (!s) return null

  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) s = fenced[1].trim()

  try {
    return JSON.parse(s)
  } catch {
    const startObj = s.indexOf('{')
    const startArr = s.indexOf('[')
    let start = -1
    if (startObj === -1) start = startArr
    else if (startArr === -1) start = startObj
    else start = Math.min(startObj, startArr)
    if (start === -1) return null
    const endChar = s[start] === '[' ? ']' : '}'
    const end = s.lastIndexOf(endChar)
    if (end <= start) return null
    try {
      return JSON.parse(s.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
