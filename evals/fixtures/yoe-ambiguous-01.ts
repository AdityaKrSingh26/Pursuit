import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "yoe-ambiguous-01",
  description: "JD says \"5+ years experience\" but implied by role level",
  jd: "We are seeking a Principal Engineer with strong React skills. YOE implied.",
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
