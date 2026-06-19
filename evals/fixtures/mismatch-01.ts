import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "mismatch-01",
  description: "Rust/embedded systems JD, resume is frontend-only",
  jd: "We are hiring an embedded engineer to write low level drivers in Rust.",
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
  "missingSkills": [
    "Rust"
  ],
  "maxMatchScore": 30,
  "injectionSafe": false,
  "schemaValid": true
}
}
