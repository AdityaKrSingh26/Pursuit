import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('../lib/env.js', () => ({
  env: { LLM_MODEL: 'gpt-4o-mini', LLM_MAX_TOKENS: 200 },
}))

vi.mock('../lib/db.js', () => ({
  prisma: {
    analysis: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('../lib/llm.js', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
}))

vi.mock('../lib/redis.js', () => ({
  redis: { eval: vi.fn() },
}))

import { prisma } from '../lib/db.js'
import { chat } from '../lib/llm.js'
import { redis } from '../lib/redis.js'
import { callLlm } from '../llm/llm.service.js'
import { hashResumeBlocks } from '../lib/resumeHash.js'

const schema = z.object({ foo: z.string() })
const blocks = [{ id: 'b1', section: 'SKILLS', content: 'Go', skillTags: ['Go'], orderDefault: 0 }]
const resumeHash = hashResumeBlocks(blocks)

const baseParams = {
  systemPrompt: 'sys',
  userMessage: 'msg',
  schema,
  applicationId: 'app-1',
  kind: 'GAP',
  jdHash: 'jd-hash',
  resumeHash,
  promptVersion: 'gap-v1',
}

describe('analysis cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.analysis.create.mockResolvedValue({})
  })

  it('looks up cache by jdHash and resumeHash together', async () => {
    prisma.analysis.findFirst.mockResolvedValue({
      result: { foo: 'cached', promptVersion: 'gap-v1' },
    })

    const result = await callLlm(baseParams)
    expect(result).toEqual({ foo: 'cached' })
    expect(chat).not.toHaveBeenCalled()
    expect(prisma.analysis.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        applicationId: 'app-1',
        kind: 'GAP',
        jdHash: 'jd-hash',
        resumeHash,
      }),
    })
  })

  it('misses cache and calls the LLM when the resume hash is different', async () => {
    prisma.analysis.findFirst.mockResolvedValue(null)
    chat.mockResolvedValue({
      text: JSON.stringify({ foo: 'fresh' }),
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    const result = await callLlm({
      ...baseParams,
      resumeHash: hashResumeBlocks([{ ...blocks[0], content: 'Rust' }]),
    })
    expect(result).toEqual({ foo: 'fresh' })
    expect(chat).toHaveBeenCalled()
    expect(prisma.analysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resumeHash: hashResumeBlocks([{ ...blocks[0], content: 'Rust' }]),
      }),
    })
  })

  it('does not read or write Analysis when persist is false', async () => {
    chat.mockResolvedValue({
      text: JSON.stringify({ foo: 'email' }),
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    const result = await callLlm({ ...baseParams, persist: false })
    expect(result).toEqual({ foo: 'email' })
    expect(prisma.analysis.findFirst).not.toHaveBeenCalled()
    expect(prisma.analysis.create).not.toHaveBeenCalled()
  })

  it('does not count a cache hit against the daily LLM quota', async () => {
    prisma.analysis.findFirst.mockResolvedValue({
      result: { foo: 'cached', promptVersion: 'gap-v1' },
    })
    await callLlm({ ...baseParams, userId: 'user-1' })
    expect(redis.eval).not.toHaveBeenCalled()
    expect(chat).not.toHaveBeenCalled()
  })

  it('increments quota on a cache miss then calls the LLM', async () => {
    prisma.analysis.findFirst.mockResolvedValue(null)
    redis.eval.mockResolvedValue(1)
    chat.mockResolvedValue({
      text: JSON.stringify({ foo: 'fresh' }),
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    await callLlm({ ...baseParams, userId: 'user-1' })
    expect(redis.eval).toHaveBeenCalled()
    expect(chat).toHaveBeenCalled()
  })

  it('consumes quota after a cache miss and 429s before calling the LLM', async () => {
    prisma.analysis.findFirst.mockResolvedValue(null)
    redis.eval.mockResolvedValue(31)
    await expect(callLlm({ ...baseParams, userId: 'user-1' })).rejects.toMatchObject({
      statusCode: 429,
    })
    expect(chat).not.toHaveBeenCalled()
  })
})
