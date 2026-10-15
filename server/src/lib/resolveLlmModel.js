// Groq shut these down for free/developer tier on 2026-08-16.
// https://console.groq.com/docs/deprecations
const GROQ_RETIRED = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
}

export function resolveLlmModel({ baseUrl = '', model }) {
  if (!model) return model
  if (!/groq\.com/i.test(baseUrl)) return model
  return GROQ_RETIRED[model] ?? model
}
