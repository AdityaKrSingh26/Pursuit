import { env } from '../../lib/env.js'
import { chat } from '../../lib/llm.js'
import { JdStructuredSchema } from '../../llm/schemas/jdStructured.schema.js'
import { buildJdParsePrompt } from '../../prompts/jd-parse.js'

export class ParseError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'ParseError'
  }
}

async function callOnce(rawText, extraInstruction = '') {
  const { text } = await chat({
    messages: [{ role: 'user', content: buildJdParsePrompt(rawText) + extraInstruction }],
    model: env.LLM_MODEL,
    maxTokens: env.LLM_MAX_TOKENS,
  })
  return JSON.parse(text)
}

export async function parseJd(rawText) {
  let parsed
  try {
    parsed = await callOnce(rawText)
  } catch {
    parsed = null
  }
  const result = JdStructuredSchema.safeParse(parsed)
  if (result.success) {
    return result.data
  }

  // One retry with validation error fed back
  const errorMsg = result.error
    ? result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    : 'Invalid schema'
  try {
    parsed = await callOnce(
      rawText,
      `\n\nPrevious attempt was invalid: ${errorMsg}. Fix and return valid JSON.`
    )
  } catch (e) {
    throw new ParseError(`LLM call failed: ${e.message}`)
  }
  const retry = JdStructuredSchema.safeParse(parsed)
  if (retry.success) {
    return retry.data
  }
  throw new ParseError(`Schema invalid after retry: ${retry.error.message}`)
}
