import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "malformed-01",
  description: "JD truncated mid-sentence, ~100 chars total",
  jd: "We are seeking a React developer who can build beautiful user interfaces and work on a team with",
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
    "React"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
