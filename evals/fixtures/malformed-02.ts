import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "malformed-02",
  description: "No skills section; only company boilerplate",
  jd: "Welcome to Acme Corp. We make software products. We are a fast growing startup located in SF.",
  resumeBlocks: [
  {
    "id": "b1",
    "section": "Skills",
    "content": "Expert in React, TypeScript, Redux, Node.js, and JavaScript.",
    "skillTags": [
      "React",
      "TypeScript",
      "Node.js",
      "JavaScript"
    ],
    "orderDefault": 1
  }
],
  expected: {
  "matchedSkills": [],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
