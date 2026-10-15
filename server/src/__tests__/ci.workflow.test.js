import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8')
}

describe('CI workflow', () => {
  const ci = read('.github/workflows/ci.yml')

  it('runs the ci job against postgres and redis, then migrate deploy from the repo root', () => {
    const ciJob = ci.split(/evals:/)[0]
    expect(ciJob).toMatch(/image:\s*pgvector\/pgvector:pg16/)
    expect(ciJob).toMatch(/image:\s*redis:/)
    expect(ciJob).toMatch(/npx prisma migrate deploy/)
    expect(ciJob).not.toMatch(/--prefix server prisma/)
  })

  it('supplies the env keys env.js requires', () => {
    for (const key of ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'LLM_PROVIDER', 'LLM_API_KEY']) {
      expect(ci).toContain(`${key}:`)
    }
  })
})

describe('evals workflow', () => {
  it('runs on pull requests that touch prompts or llm', () => {
    const evals = read('.github/workflows/evals.yml')
    expect(evals).toMatch(/pull_request/)
    expect(evals).toContain('server/src/prompts/**')
    expect(evals).toContain('server/src/llm/**')
    expect(evals).toMatch(/npx prisma migrate deploy/)
    expect(evals).not.toMatch(/--prefix server prisma/)
    for (const key of ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'LLM_PROVIDER', 'LLM_API_KEY']) {
      expect(evals).toContain(key)
    }
  })
})

describe('onboarding files', () => {
  it('lists every key env.js parses in .env.example', () => {
    const envJs = read('server/src/lib/env.js')
    const example = read('.env.example')
    const keys = [...envJs.matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(5)
    for (const key of keys) {
      expect(example).toMatch(new RegExp(`^${key}=`, 'm'))
    }
  })

  it('tells people to run prisma from the repo root', () => {
    const readme = read('README.md')
    expect(readme).toContain('npx prisma migrate deploy')
    expect(readme).toContain('npx prisma migrate dev')
    expect(readme).toContain('npx prisma generate')
    expect(readme).not.toContain('npx --prefix server prisma')
  })

  it('lints both the server and the client', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts.lint).toMatch(/server/)
    expect(pkg.scripts.lint).toMatch(/client/)
  })

  it('tells typecheck the API stays JavaScript', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts.typecheck).toMatch(/client/)
    expect(pkg.scripts.typecheck).not.toMatch(/server/)
    expect(read('README.md')).toMatch(/API stays JavaScript/)
    expect(read('docs/architecture.md')).toMatch(/Server language \| JavaScript/)
  })

  it('declares Node fetch globals so server lint can pass', () => {
    const eslint = read('server/eslint.config.js')
    expect(eslint).toMatch(/fetch:\s*['"]readonly['"]/)
    expect(eslint).toMatch(/AbortSignal:\s*['"]readonly['"]/)
  })

  it('does not depend on the unused AWS SDK', () => {
    const pkg = JSON.parse(read('server/package.json'))
    expect(JSON.stringify(pkg.dependencies ?? {})).not.toMatch(/@aws-sdk/)
    expect(JSON.stringify(pkg.devDependencies ?? {})).not.toMatch(/@aws-sdk/)
  })

  it('does not pin Groq’s retired llama-3.3-70b-versatile', () => {
    expect(read('.env.example')).not.toContain('llama-3.3-70b-versatile')
    expect(read('.github/workflows/ci.yml')).not.toContain('llama-3.3-70b-versatile')
    expect(read('.github/workflows/evals.yml')).not.toContain('llama-3.3-70b-versatile')
  })
})
