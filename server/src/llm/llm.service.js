import Anthropic from '@anthropic-ai/sdk'
import { env } from '../lib/env.js'
import { prisma } from '../lib/db.js'

let client
function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: env.LLM_API_KEY || 'dummy-key',
      timeout: 30000,
    })
  }
  return client
}

async function callOnce(systemPrompt, userMessage) {
  const anthropic = getClient()
  return await anthropic.messages.create({
    model: env.LLM_MODEL,
    max_tokens: env.LLM_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })
}

export function computeCost(model, usage) {
  const input = usage.input_tokens || 0
  const output = usage.output_tokens || 0

  const mName = model.toLowerCase()
  if (mName.includes('sonnet') || mName.includes('claude-3-5') || mName.includes('claude-sonnet')) {
    return (input * 3 + output * 15) / 1000000
  }
  if (mName.includes('haiku')) {
    return (input * 0.25 + output * 1.25) / 1000000
  }
  if (mName.includes('opus')) {
    return (input * 15 + output * 75) / 1000000
  }

  console.warn(`Unknown pricing model: ${model}`)
  return 0
}

export async function callLlm({
  systemPrompt,
  userMessage,
  schema,
  applicationId,
  kind,
  jdHash,
  resumeVersionId,
  promptVersion,
}) {
  // 1. Cache check
  const cached = await prisma.analysis.findFirst({
    where: {
      applicationId,
      kind,
      jdHash,
      resumeVersionId: resumeVersionId ?? null,
    },
  })
  if (cached && cached.result && cached.result.promptVersion === promptVersion) {
    const { promptVersion: _, ...data } = cached.result
    return schema.parse(data)
  }

  // 2. Call LLM
  let response = await callOnce(systemPrompt, userMessage)
  let responseText = response.content[0].type === 'text' ? response.content[0].text : ''

  // 3. Validate & Retry once if invalid
  let parsed
  try {
    parsed = JSON.parse(responseText)
  } catch {
    parsed = null
  }
  let result = schema.safeParse(parsed)

  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    const retryPrompt = `\n\nPrevious attempt was invalid: ${errorMsg}. Fix and return valid JSON.`
    const anthropic = getClient()
    response = await anthropic.messages.create({
      model: env.LLM_MODEL,
      max_tokens: env.LLM_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: responseText },
        { role: 'user', content: retryPrompt },
      ],
    })
    responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    try {
      parsed = JSON.parse(responseText)
    } catch {
      parsed = null
    }
    result = schema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`Schema invalid after retry: ${result.error.message}`)
    }
  }

  const validatedData = result.data

  // 4. Log/Write Analysis row
  const usage = response.usage || { input_tokens: 0, output_tokens: 0 }
  const tokensIn = usage.input_tokens
  const tokensOut = usage.output_tokens
  const costUsd = computeCost(env.LLM_MODEL, usage)

  await prisma.analysis.create({
    data: {
      applicationId,
      kind,
      jdHash,
      resumeVersionId: resumeVersionId ?? null,
      result: { ...validatedData, promptVersion },
      tokensIn,
      tokensOut,
      costUsd,
    },
  })

  return validatedData
}

export async function streamLlm({
  systemPrompt,
  userMessage,
  schema,
  applicationId,
  kind,
  jdHash,
  resumeVersionId,
  promptVersion,
}, onToken, onDone) {
  // 1. Cache check
  const cached = await prisma.analysis.findFirst({
    where: {
      applicationId,
      kind,
      jdHash,
      resumeVersionId: resumeVersionId ?? null,
    },
  })
  if (cached && cached.result && cached.result.promptVersion === promptVersion) {
    const { promptVersion: _, ...data } = cached.result
    onDone(schema.parse(data))
    return
  }

  // 2. Stream LLM
  const anthropic = getClient()
  const stream = anthropic.messages.stream({
    model: env.LLM_MODEL,
    max_tokens: env.LLM_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  stream.on('text', (textDelta) => {
    onToken(textDelta)
  })

  const message = await stream.finalMessage()
  let responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  // 3. Validate & Retry once if invalid
  let parsed
  try {
    parsed = JSON.parse(responseText)
  } catch {
    parsed = null
  }
  let result = schema.safeParse(parsed)
  let finalMessage = message

  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    const retryPrompt = `\n\nPrevious attempt was invalid: ${errorMsg}. Fix and return valid JSON.`
    finalMessage = await anthropic.messages.create({
      model: env.LLM_MODEL,
      max_tokens: env.LLM_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: responseText },
        { role: 'user', content: retryPrompt },
      ],
    })
    responseText = finalMessage.content[0].type === 'text' ? finalMessage.content[0].text : ''
    try {
      parsed = JSON.parse(responseText)
    } catch {
      parsed = null
    }
    result = schema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`Schema invalid after retry: ${result.error.message}`)
    }
  }

  const validatedData = result.data

  // 4. Log/Write Analysis row
  const usage = finalMessage.usage || { input_tokens: 0, output_tokens: 0 }
  const tokensIn = usage.input_tokens
  const tokensOut = usage.output_tokens
  const costUsd = computeCost(env.LLM_MODEL, usage)

  await prisma.analysis.create({
    data: {
      applicationId,
      kind,
      jdHash,
      resumeVersionId: resumeVersionId ?? null,
      result: { ...validatedData, promptVersion },
      tokensIn,
      tokensOut,
      costUsd,
    },
  })

  onDone(validatedData)
}
