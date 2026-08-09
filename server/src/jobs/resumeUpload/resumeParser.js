import { env } from '../../lib/env.js'
import { chat } from '../../lib/llm.js'
import { ResumeParseSchema } from '../../llm/schemas/resumeParse.schema.js'
import { buildResumeParsePrompt } from '../../prompts/resume-parse.js'

export class ResumeParseError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'ResumeParseError'
  }
}

function extractJsonArray(text) {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']') + 1
  if (start === -1 || end === 0) return null
  try {
    return JSON.parse(text.slice(start, end))
  } catch {
    return null
  }
}

async function callOnce(rawText, extraInstruction = '') {
  const { text } = await chat({
    messages: [{ role: 'user', content: buildResumeParsePrompt(rawText) + extraInstruction }],
    model: env.LLM_MODEL,
    maxTokens: env.LLM_MAX_TOKENS,
  })
  return extractJsonArray(text)
}

export async function parseResume(rawText) {
  let parsed
  try {
    parsed = await callOnce(rawText)
  } catch {
    parsed = null
  }
  let result = ResumeParseSchema.safeParse(parsed)
  if (result.success) return result.data

  const errorMsg = result.error
    ? result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    : 'Invalid schema'
  try {
    parsed = await callOnce(
      rawText,
      `\n\nPrevious attempt was invalid: ${errorMsg}. Fix and return valid JSON.`
    )
  } catch (e) {
    throw new ResumeParseError(`LLM call failed: ${e.message}`)
  }
  result = ResumeParseSchema.safeParse(parsed)
  if (result.success) return result.data
  throw new ResumeParseError(`Schema invalid after retry: ${result.error.message}`)
}
