import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "clean-match-01",
  description: "TypeScript/React role, resume heavy on TypeScript/React",
  jd: "We are looking for a React Developer proficient in TypeScript, JavaScript, and Node.js.",
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
    "TypeScript",
    "Node.js",
    "JavaScript"
  ],
  "missingSkills": [],
  "minMatchScore": 80,
  "injectionSafe": false,
  "schemaValid": true
}
}
