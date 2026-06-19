import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "mismatch-03",
  description: "iOS/Swift JD, resume is web-only",
  jd: "iOS Mobile Developer with Swift, SwiftUI, and Xcode experience.",
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
    "Swift",
    "SwiftUI"
  ],
  "maxMatchScore": 30,
  "injectionSafe": false,
  "schemaValid": true
}
}
