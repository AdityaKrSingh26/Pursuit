import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { env } from './env.js'

let _anthropic, _openai

function anthropicClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: env.LLM_API_KEY, timeout: 30000 })
  return _anthropic
}

function openaiClient() {
  if (!_openai) {
    const defaultHeaders = {}
    if (env.LLM_BASE_URL && env.LLM_BASE_URL.includes('github')) {
      defaultHeaders['Accept'] = 'application/vnd.github+json'
      defaultHeaders['X-GitHub-Api-Version'] = '2022-11-28'
    }
    _openai = new OpenAI({
      apiKey: env.LLM_API_KEY,
      ...(env.LLM_BASE_URL ? { baseURL: env.LLM_BASE_URL } : {}),
      defaultHeaders,
    })
  }
  return _openai
}

// chat({ system?, messages, model, maxTokens })
// Returns { text, usage: { input_tokens, output_tokens } }
export async function chat({ system, messages, model, maxTokens }) {
  if (env.LLM_PROVIDER === 'openai') {
    const openaiMessages = system ? [{ role: 'system', content: system }, ...messages] : messages
    const res = await openaiClient().chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
    })
    return {
      text: res.choices[0]?.message?.content || '',
      usage: { input_tokens: res.usage.prompt_tokens, output_tokens: res.usage.completion_tokens },
    }
  }

  const res = await anthropicClient().messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  })
  return {
    text: res.content[0]?.type === 'text' ? res.content[0].text : '',
    usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens },
  }
}

// chatStream({ system?, messages, model, maxTokens }, onToken)
// Returns { text, usage: { input_tokens, output_tokens } }
export async function chatStream({ system, messages, model, maxTokens }, onToken) {
  if (env.LLM_PROVIDER === 'openai') {
    const openaiMessages = system ? [{ role: 'system', content: system }, ...messages] : messages
    const stream = await openaiClient().chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
      stream: true,
      stream_options: { include_usage: true },
    })
    let text = ''
    let usage = { input_tokens: 0, output_tokens: 0 }
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) { text += delta; onToken(delta) }
      if (chunk.usage) {
        usage = { input_tokens: chunk.usage.prompt_tokens, output_tokens: chunk.usage.completion_tokens }
      }
    }
    return { text, usage }
  }

  const s = anthropicClient().messages.stream({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  })
  s.on('text', onToken)
  const message = await s.finalMessage()
  return {
    text: message.content[0]?.type === 'text' ? message.content[0].text : '',
    usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
  }
}

// embed(text) → number[]
// Uses EMBEDDING_API_KEY if set, otherwise falls back to LLM_API_KEY.
// Needed when LLM_PROVIDER=anthropic (LLM_API_KEY is an Anthropic key) but
// embeddings still go to OpenAI.
export async function embed(text) {
  const apiKey = env.EMBEDDING_API_KEY || env.LLM_API_KEY
  const model = env.EMBEDDING_MODEL || 'text-embedding-3-small'
  const baseUrl = env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1'

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (baseUrl.includes('github')) {
    headers['Accept'] = 'application/vnd.github+json'
    headers['X-GitHub-Api-Version'] = '2022-11-28'
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, input: text }),
  })

  if (!response.ok) {
    throw new Error(`Embedding API error ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  if (!data?.data?.[0]?.embedding) {
    throw new Error('Invalid embedding response format')
  }

  return data.data[0].embedding
}
