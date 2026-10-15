import { env } from '../lib/env.js'
import { prisma } from '../lib/db.js'
import { chat, chatStream } from '../lib/llm.js'
import { parseJsonFromLlm } from '../lib/llmJson.js'
import { consumeLlmQuota } from '../middleware/rateLimitLlm.js'

export function computeCost(model, usage) {
  const input = usage.input_tokens || 0
  const output = usage.output_tokens || 0

  const m = model.toLowerCase()
  // Anthropic
  if (m.includes('sonnet') || m.includes('claude-3-5') || m.includes('claude-sonnet')) return (input * 3 + output * 15) / 1_000_000
  if (m.includes('haiku')) return (input * 0.25 + output * 1.25) / 1_000_000
  if (m.includes('opus')) return (input * 15 + output * 75) / 1_000_000
  // OpenAI
  if (m.includes('gpt-4o-mini')) return (input * 0.15 + output * 0.6) / 1_000_000
  if (m.includes('gpt-4o')) return (input * 2.5 + output * 10) / 1_000_000
  if (m.includes('gpt-4')) return (input * 30 + output * 60) / 1_000_000
  if (m.includes('gpt-3.5')) return (input * 0.5 + output * 1.5) / 1_000_000

  console.warn(`Unknown pricing model: ${model}`)
  return 0
}

async function _checkCache({ applicationId, kind, jdHash, resumeHash, resumeVersionId, promptVersion }, schema) {
  const cached = await prisma.analysis.findFirst({
    where: {
      applicationId,
      kind,
      jdHash,
      resumeHash: resumeHash ?? '',
      resumeVersionId: resumeVersionId ?? null,
    },
  })
  if (cached && cached.result && cached.result.promptVersion === promptVersion) {
    const { promptVersion: _, ...data } = cached.result
    return schema.parse(data)
  }
  return null
}

// Returns { data, usage }. usage is from the retry response if a retry occurred, otherwise null.
async function _validateWithRetry(responseText, schema, systemPrompt, userMessage) {
  const parsed = parseJsonFromLlm(responseText)

  let result = schema.safeParse(parsed)
  if (result.success) {
    return { data: result.data, usage: null }
  }

  const errorMsg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
  const retryPrompt = `\n\nPrevious attempt was invalid: ${errorMsg}. Fix and return valid JSON.`
  const retry = await chat({
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: responseText },
      { role: 'user', content: retryPrompt },
    ],
    model: env.LLM_MODEL,
    maxTokens: env.LLM_MAX_TOKENS,
  })

  const retryParsed = parseJsonFromLlm(retry.text)

  result = schema.safeParse(retryParsed)
  if (!result.success) {
    throw new Error(`Schema invalid after retry: ${result.error.message}`)
  }

  return { data: result.data, usage: retry.usage }
}

async function _writeAnalysis(params, validatedData, usage) {
  const { applicationId, kind, jdHash, resumeHash, resumeVersionId, promptVersion } = params
  const costUsd = computeCost(env.LLM_MODEL, usage)

  await prisma.analysis.create({
    data: {
      applicationId,
      kind,
      jdHash,
      resumeHash: resumeHash ?? '',
      resumeVersionId: resumeVersionId ?? null,
      result: { ...validatedData, promptVersion },
      tokensIn: usage.input_tokens,
      tokensOut: usage.output_tokens,
      costUsd,
    },
  })
}

export async function callLlm({ systemPrompt, userMessage, schema, persist = true, userId, ...params }) {
  if (persist) {
    const cached = await _checkCache(params, schema)
    if (cached !== null) {
      return cached
    }
  }

  if (userId) {
    await consumeLlmQuota(userId)
  }

  const response = await chat({
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    model: env.LLM_MODEL,
    maxTokens: env.LLM_MAX_TOKENS,
  })

  const { data: validatedData, usage: retryUsage } = await _validateWithRetry(response.text, schema, systemPrompt, userMessage)
  const base = response.usage || { input_tokens: 0, output_tokens: 0 }
  const usage = retryUsage
    ? { input_tokens: base.input_tokens + retryUsage.input_tokens, output_tokens: base.output_tokens + retryUsage.output_tokens }
    : base

  if (persist) {
    await _writeAnalysis(params, validatedData, usage)
  }

  return validatedData
}

export async function streamLlm({ systemPrompt, userMessage, schema, persist = true, userId, ...params }, onToken, onDone) {
  if (persist) {
    const cached = await _checkCache(params, schema)
    if (cached !== null) {
      onDone(cached)
      return
    }
  }

  if (userId) {
    await consumeLlmQuota(userId)
  }

  const response = await chatStream(
    {
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      model: env.LLM_MODEL,
      maxTokens: env.LLM_MAX_TOKENS,
    },
    onToken,
  )

  const { data: validatedData, usage: retryUsage } = await _validateWithRetry(response.text, schema, systemPrompt, userMessage)
  const base = response.usage || { input_tokens: 0, output_tokens: 0 }
  const usage = retryUsage
    ? { input_tokens: base.input_tokens + retryUsage.input_tokens, output_tokens: base.output_tokens + retryUsage.output_tokens }
    : base

  if (persist) {
    await _writeAnalysis(params, validatedData, usage)
  }

  onDone(validatedData)
}
