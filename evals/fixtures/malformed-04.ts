import { EvalFixture } from './types'

export const fixture: EvalFixture = {
  id: "malformed-04",
  description: "Non-job-posting text (Wikipedia article intro)",
  jd: "React is a free and open-source front-end JavaScript library for building user interfaces based on components.",
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
    "JavaScript"
  ],
  "missingSkills": [],
  "injectionSafe": false,
  "schemaValid": true
}
}
