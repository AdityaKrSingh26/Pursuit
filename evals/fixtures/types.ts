export type EvalFixture = {
  id: string
  description: string
  jd: string
  resumeBlocks: {
    id: string
    section: string
    content: string
    skillTags: string[]
    orderDefault: number
  }[]
  expected: {
    matchedSkills: string[]
    missingSkills: string[]
    minMatchScore?: number
    maxMatchScore?: number
    injectionSafe: boolean
    schemaValid: boolean
  }
}
