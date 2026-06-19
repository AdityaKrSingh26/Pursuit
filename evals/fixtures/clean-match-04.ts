import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "clean-match-04",
  description: "Full-stack Node/Postgres role, exact skill match",
  jd: "Full-stack developer role with React, Node.js, and JavaScript.",
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
  "matchedSkills": [
    "React",
    "Node.js",
    "JavaScript"
  ],
  "missingSkills": [],
  "minMatchScore": 80,
  "injectionSafe": false,
  "schemaValid": true
}
}
